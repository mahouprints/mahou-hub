import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PedidoImport, PedidoItemImport, PedidoStatus } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { statusInterno, statusJobPara } from './status-marketplace';

// Os tipos vêm do schema Zod em `packages/contracts` — os aliases existem só pra
// manter a leitura em pt-BR dentro do módulo. Definir interfaces próprias aqui
// duplicaria o contrato e deixaria os dois divergirem em silêncio.
export type ItemImportado = PedidoItemImport;
export type PedidoImportado = PedidoImport;

@Injectable()
export class AtendimentoService {
  private readonly logger = new Logger(AtendimentoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Importa um pedido e tenta atender cada item.
   *
   * Tudo numa transação só: um pedido que baixa estoque de metade dos itens e falha
   * na outra metade deixaria o saldo mentindo. Ou atende tudo o que dá, ou nada.
   *
   * Reimportar o mesmo pedido é seguro — o `@@unique([canal, externalId])` faz o
   * upsert atualizar o status externo sem duplicar nem re-baixar estoque.
   */
  async importar(pedido: PedidoImportado) {
    const jaExiste = await this.prisma.pedidoMarketplace.findUnique({
      where: { canal_externalId: { canal: pedido.canal, externalId: pedido.externalId } },
      select: { id: true, status: true },
    });

    if (jaExiste) {
      return this.atualizarStatus(jaExiste.id, jaExiste.status, pedido);
    }

    return this.prisma.$transaction(async (tx) => {
      const criado = await tx.pedidoMarketplace.create({
        data: {
          canal: pedido.canal,
          externalId: pedido.externalId,
          statusExterno: pedido.statusExterno,
          compradorNome: pedido.compradorNome ?? null,
          totalCentavos: pedido.totalCentavos,
          prazoEnvio: pedido.prazoEnvio ?? null,
          dataPedido: pedido.dataPedido,
        },
      });

      let itensAtendidos = 0;
      let itensSemVinculo = 0;

      for (const item of pedido.itens) {
        const resultado = await this.atenderItem(tx, criado.id, item, pedido);
        if (resultado === 'SEM_VINCULO') itensSemVinculo++;
        else itensAtendidos++;
      }

      const status = itensSemVinculo > 0 ? 'BLOQUEADO' : 'ATENDIDO';
      await tx.pedidoMarketplace.update({
        where: { id: criado.id },
        data: {
          status,
          observacao:
            itensSemVinculo > 0
              ? `${itensSemVinculo} item(ns) com SKU sem vínculo no catálogo — vincule para atender.`
              : null,
        },
      });

      this.logger.log(
        `Pedido ${pedido.canal}/${pedido.externalId}: ${itensAtendidos} atendidos, ` +
          `${itensSemVinculo} sem vínculo`,
      );
      return {
        pedidoId: criado.id,
        novo: true,
        itensAtendidos,
        itensSemVinculo,
        statusAtualizado: null as PedidoStatus | null,
      };
    });
  }

  /**
   * Reimportação de pedido conhecido: reflete a mudança de status do marketplace.
   *
   * É assim que o Hub sabe que a peça saiu — quando a Shopee move o pedido pra
   * PROCESSED/SHIPPED, o pedido vira ENVIADO aqui e os cards de produção dele fecham.
   * Sem isso o pedido ficaria "atendido" pra sempre e o kanban acumularia card morto.
   */
  private async atualizarStatus(
    pedidoId: string,
    statusAtual: PedidoStatus,
    pedido: PedidoImportado,
  ) {
    const novo = statusInterno(pedido.canal, pedido.statusExterno);
    const mudou = novo !== null && novo !== statusAtual;

    await this.prisma.pedidoMarketplace.update({
      where: { id: pedidoId },
      data: { statusExterno: pedido.statusExterno, ...(mudou ? { status: novo } : {}) },
    });

    if (mudou) {
      await this.fecharJobsDoPedido(pedidoId, novo);
      await this.desfazerVendasSeCancelado(pedidoId, novo);
      this.logger.log(
        `Pedido ${pedido.canal}/${pedido.externalId}: ${statusAtual} → ${novo} ` +
          `(${pedido.statusExterno})`,
      );
    }

    return {
      pedidoId,
      novo: false,
      itensAtendidos: 0,
      itensSemVinculo: 0,
      statusAtualizado: mudou ? novo : null,
    };
  }

  /**
   * Fecha os cards de produção de um pedido que saiu ou foi cancelado.
   *
   * Só mexe em card que ainda está aberto: um job já marcado EMBALADO/ENVIADO pelo
   * fluxo manual do kanban não é reescrito, senão o histórico de quem fez o quê some.
   */
  private async fecharJobsDoPedido(pedidoId: string, status: PedidoStatus) {
    const statusJob = statusJobPara(status);
    if (!statusJob) return;

    const itens = await this.prisma.pedidoItem.findMany({
      where: { pedidoId, jobProducaoId: { not: null } },
      select: { jobProducaoId: true },
    });
    const jobIds = itens.map((i) => i.jobProducaoId).filter((id): id is string => id !== null);
    if (jobIds.length === 0) return;

    await this.prisma.jobProducao.updateMany({
      where: { id: { in: jobIds }, status: { in: ['FILA', 'IMPRIMINDO', 'CONCLUIDO'] } },
      data: { status: statusJob },
    });
  }

  /**
   * Pedido cancelado deixa de contar como faturamento.
   *
   * Só apaga venda que ESTE fluxo criou (as que têm `pedidoItemId`) — venda lançada à mão
   * nunca é tocada, mesmo que pareça a mesma coisa.
   *
   * Não estorna o estoque de propósito: quem cancela depois de despachar não recupera a
   * peça, e cancelamento antes disso o Gabriel resolve no kanban. Devolver saldo aqui
   * criaria peça que não existe na prateleira.
   */
  private async desfazerVendasSeCancelado(pedidoId: string, status: PedidoStatus) {
    if (status !== 'CANCELADO') return;

    const itens = await this.prisma.pedidoItem.findMany({
      where: { pedidoId },
      select: { id: true },
    });
    const { count } = await this.prisma.venda.deleteMany({
      where: { pedidoItemId: { in: itens.map((i) => i.id) } },
    });
    if (count > 0) this.logger.log(`Pedido cancelado: ${count} venda(s) removida(s)`);
  }

  /**
   * Resolve um item: baixa do estoque de prontos se houver peça, senão põe na fila.
   *
   * O match é por SKU EXATO. Não tentamos aproximar por nome: vincular errado baixa
   * estoque do produto errado e só se descobre quando falta peça na hora de despachar.
   * Sem match, o item fica SEM_VINCULO esperando o humano.
   */
  private async atenderItem(
    tx: Prisma.TransactionClient,
    pedidoId: string,
    item: ItemImportado,
    pedido: PedidoImportado,
  ): Promise<'BAIXADO_ESTOQUE' | 'EM_PRODUCAO' | 'SEM_VINCULO'> {
    const variacao = await tx.produtoVariacao.findUnique({
      where: { sku: item.skuExterno },
      select: { id: true, produtoId: true, estoqueAtual: true, nome: true },
    });

    if (!variacao) {
      await tx.pedidoItem.create({
        data: { pedidoId, ...this.camposItem(item), atendimento: 'SEM_VINCULO' },
      });
      return 'SEM_VINCULO';
    }

    return this.atenderComVariacao(tx, pedidoId, item, pedido, variacao);
  }

  /**
   * Dá baixa ou põe na fila, com a variação JÁ resolvida.
   *
   * Separado de `atenderItem` porque o vínculo manual chega aqui com a variação que o
   * humano escolheu — e não tem SKU pra procurar: se tivesse, o item não estaria órfão.
   * Enquanto isso morava junto com a busca por SKU, o botão "vincular" refazia a busca
   * que já tinha falhado, criava outro item órfão e apagava o que acabara de ser ligado.
   */
  private async atenderComVariacao(
    tx: Prisma.TransactionClient,
    pedidoId: string,
    item: ItemImportado,
    pedido: PedidoImportado,
    variacao: { id: string; produtoId: string; estoqueAtual: number; nome: string },
  ): Promise<'BAIXADO_ESTOQUE' | 'EM_PRODUCAO'> {
    if (variacao.estoqueAtual >= item.qtd) {
      const novoSaldo = variacao.estoqueAtual - item.qtd;
      await tx.produtoVariacao.update({
        where: { id: variacao.id },
        data: { estoqueAtual: novoSaldo },
      });
      await tx.movimentoEstoque.create({
        data: {
          tipoItem: 'PRODUTO',
          variacaoId: variacao.id,
          quantidade: new Prisma.Decimal(-item.qtd),
          saldoApos: new Prisma.Decimal(novoSaldo),
          motivo: 'VENDA',
          observacao: `Pedido ${pedido.canal} ${pedido.externalId}`,
        },
      });
      const linha = await tx.pedidoItem.create({
        data: {
          pedidoId,
          ...this.camposItem(item),
          variacaoId: variacao.id,
          atendimento: 'BAIXADO_ESTOQUE',
        },
      });
      await this.registrarVenda(tx, linha.id, variacao, item, pedido);
      return 'BAIXADO_ESTOQUE';
    }

    // Sem peça pronta: entra na fila. `daEstoque: false` porque vai imprimir de verdade,
    // e é isso que faz o consumo de filamento ser debitado quando o card for concluído.
    const job = await tx.jobProducao.create({
      data: {
        dataInicio: new Date(),
        origem: pedido.canal === 'SHOPEE' ? 'SHOPEE' : 'ML',
        produtoId: variacao.produtoId,
        variacaoId: variacao.id,
        qtd: item.qtd,
        impressora: 'A1',
        status: 'FILA',
        // Prazo apertado sobe na fila: o kanban ordena por prioridade decrescente.
        prioridade: this.prioridadePorPrazo(pedido.prazoEnvio),
        observacao: `Pedido ${pedido.canal} ${pedido.externalId} — ${variacao.nome}`,
      },
    });

    const linha = await tx.pedidoItem.create({
      data: {
        pedidoId,
        ...this.camposItem(item),
        variacaoId: variacao.id,
        atendimento: 'EM_PRODUCAO',
        jobProducaoId: job.id,
      },
    });
    await this.registrarVenda(tx, linha.id, variacao, item, pedido);
    return 'EM_PRODUCAO';
  }

  /**
   * Transforma o item atendido em `Venda`, que é o que o dashboard financeiro lê.
   *
   * Sem isso, tudo que vem de marketplace ficava fora do faturamento — o financeiro só
   * enxergava o que o Gabriel lançava à mão. A venda nasce no atendimento, e não no envio,
   * porque nesse ponto o cliente já pagou; cancelamento depois apaga a linha.
   *
   * `pedidoItemId` é unique: reimportar o pedido (o que acontece a cada mudança de status)
   * não fatura de novo.
   */
  private async registrarVenda(
    tx: Prisma.TransactionClient,
    pedidoItemId: string,
    variacao: { id: string; produtoId: string; nome: string },
    item: ItemImportado,
    pedido: PedidoImportado,
  ) {
    await tx.venda.create({
      data: {
        produtoId: variacao.produtoId,
        variacaoId: variacao.id,
        pedidoItemId,
        qtd: item.qtd,
        precoUnitarioCentavos: item.precoUnitarioCentavos,
        canal: pedido.canal,
        dataVenda: pedido.dataPedido,
        observacao: `${pedido.canal} ${pedido.externalId} — ${variacao.nome}`,
      },
    });
  }

  private camposItem(item: ItemImportado) {
    return {
      skuExterno: item.skuExterno,
      nomeExterno: item.nomeExterno,
      qtd: item.qtd,
      precoUnitarioCentavos: item.precoUnitarioCentavos,
    };
  }

  /**
   * Prioridade cresce conforme o prazo aperta. Sem prazo informado, prioridade 0 —
   * o card entra no fim da fila em vez de furar sem motivo.
   */
  private prioridadePorPrazo(prazo?: Date | null): number {
    if (!prazo) return 0;
    const horas = (prazo.getTime() - Date.now()) / 3_600_000;
    if (horas <= 24) return 100;
    if (horas <= 48) return 50;
    if (horas <= 72) return 20;
    return 10;
  }

  /**
   * Liga um item órfão a uma variação e atende na hora. É o que o humano chama
   * depois de descobrir qual produto é aquele SKU desconhecido.
   */
  async vincularItem(itemId: string, variacaoId: string) {
    const item = await this.prisma.pedidoItem.findUnique({
      where: { id: itemId },
      include: { pedido: { select: { canal: true, externalId: true, prazoEnvio: true } } },
    });
    // NotFoundException e não Error: item inexistente é 404 pro cliente, não 500.
    if (!item) throw new NotFoundException(`Item de pedido ${itemId} não existe`);

    return this.prisma.$transaction(async (tx) => {
      const variacao = await tx.produtoVariacao.findUnique({
        where: { id: variacaoId },
        select: { id: true, produtoId: true, estoqueAtual: true, nome: true },
      });
      if (!variacao) throw new NotFoundException(`Variação ${variacaoId} não existe`);

      const atendimento = await this.atenderComVariacao(
        tx,
        item.pedidoId,
        {
          skuExterno: item.skuExterno,
          nomeExterno: item.nomeExterno,
          qtd: item.qtd,
          precoUnitarioCentavos: item.precoUnitarioCentavos,
        },
        // Só `canal`, `externalId` e `prazoEnvio` são lidos daqui (observação do movimento
        // e prioridade do job). O resto é preenchimento do tipo.
        {
          canal: item.pedido.canal as 'SHOPEE' | 'ML',
          externalId: item.pedido.externalId,
          statusExterno: '',
          totalCentavos: 0,
          prazoEnvio: item.pedido.prazoEnvio,
          dataPedido: new Date(),
          itens: [],
        },
        variacao,
      );
      // A linha nova já nasce com o vínculo; a órfã sai pra não duplicar o item no pedido.
      await tx.pedidoItem.delete({ where: { id: itemId } });

      const restamOrfaos = await tx.pedidoItem.count({
        where: { pedidoId: item.pedidoId, atendimento: 'SEM_VINCULO' },
      });
      if (restamOrfaos === 0) {
        await tx.pedidoMarketplace.update({
          where: { id: item.pedidoId },
          data: { status: 'ATENDIDO', observacao: null },
        });
      }
      return { atendimento, restamOrfaos };
    });
  }
}
