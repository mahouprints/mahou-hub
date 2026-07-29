import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';

type ItemDoRecibo = Prisma.ReciboItemGetPayload<Record<string, never>>;

/**
 * Aplica um recibo revisado: estocável vira saldo, não-estocável vira `Custo`.
 *
 * A separação não é estética. `financeiro.service` desconta do lucro tanto o `Custo` do mês
 * quanto o filamento consumido em cada venda — lançar a compra do rolo como custo faria o
 * mesmo dinheiro sair duas vezes do resultado.
 */
@Injectable()
export class ConfirmacaoReciboService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
  ) {}

  async confirmar(reciboId: string) {
    const recibo = await this.prisma.recibo.findUnique({
      where: { id: reciboId },
      include: { itens: { orderBy: { criadoEm: 'asc' } } },
    });
    if (!recibo) throw new NotFoundException(`Recibo ${reciboId} não existe`);
    if (recibo.status === 'CONFIRMADO') return this.comItens(reciboId);
    if (recibo.itens.length === 0) {
      throw new BadRequestException('Recibo sem itens — leia a nota antes de confirmar');
    }

    const pendencias = recibo.itens.flatMap((i) => descreverPendencias(i));
    if (pendencias.length > 0) {
      throw new BadRequestException(`Faltam dados pra confirmar: ${pendencias.join('; ')}`);
    }

    for (const item of recibo.itens) {
      if (item.movimentoRegistrado) continue;
      await this.aplicarItem(item, recibo.fornecedor, recibo.data);
    }

    await this.prisma.recibo.update({
      where: { id: reciboId },
      data: { status: 'CONFIRMADO', confirmadoEm: new Date() },
    });
    return this.comItens(reciboId);
  }

  /**
   * Um item por vez, cada um marcando `movimentoRegistrado` logo depois de aplicar.
   *
   * Sem transação cobrindo o recibo inteiro de propósito: `EstoqueService.registrarMovimento`
   * já abre a sua, e Prisma não aninha. Se der erro no meio, o que entrou fica marcado e
   * reconfirmar retoma dos que faltaram, em vez de duplicar os que já entraram.
   */
  private async aplicarItem(item: ItemDoRecibo, fornecedor: string | null, data: Date) {
    const observacao = `Recibo${fornecedor ? ` ${fornecedor}` : ''} — ${item.descricaoNota}`.slice(
      0,
      500,
    );

    if (item.tipo === 'NAO_ESTOCAVEL') {
      await this.prisma.custo.create({
        data: {
          descricao: item.descricaoNota,
          categoria: item.categoriaCusto ?? 'OUTROS',
          valorCentavos: item.valorTotalCentavos ?? 0,
          dataCompetencia: data,
          observacao,
        },
      });
    } else {
      await this.estoque.registrarMovimento({
        tipoItem: item.tipo === 'FILAMENTO' ? 'FILAMENTO' : 'INSUMO',
        filamentoId: item.filamentoId ?? undefined,
        insumoId: item.insumoId ?? undefined,
        // Filamento entra em gramas; insumo, na unidade do próprio cadastro.
        quantidade: item.tipo === 'FILAMENTO' ? (item.gramasTotal ?? 0) : Number(item.quantidade),
        motivo: 'COMPRA',
        // Preço unitário como está na nota (por rolo, por caixa). O campo não alimenta
        // cálculo nenhum hoje — é histórico —, e a observação diz a que se refere.
        custoUnitCentavos: item.valorUnitCentavos,
        observacao,
      });
    }

    await this.prisma.reciboItem.update({
      where: { id: item.id },
      data: { movimentoRegistrado: true },
    });
  }

  private comItens(reciboId: string) {
    return this.prisma.recibo.findUniqueOrThrow({
      where: { id: reciboId },
      include: {
        arquivos: { orderBy: { criadoEm: 'asc' } },
        itens: { orderBy: { criadoEm: 'asc' } },
      },
    });
  }
}

/**
 * O que ainda impede a linha de virar movimento. Devolve frase pronta pra tela — a UI
 * repete pro Gabriel, então tem que dizer QUAL item e o QUE falta.
 */
function descreverPendencias(item: ItemDoRecibo): string[] {
  const falta = (o: string) => `"${item.descricaoNota}" sem ${o}`;

  if (!item.tipo) return [falta('classificação (filamento, insumo ou não-estocável)')];

  if (item.tipo === 'FILAMENTO') {
    return [
      ...(item.filamentoId ? [] : [falta('filamento vinculado')]),
      ...(item.gramasTotal ? [] : [falta('peso total em gramas')]),
    ];
  }
  if (item.tipo === 'INSUMO') {
    return [
      ...(item.insumoId ? [] : [falta('insumo vinculado')]),
      ...(item.quantidade ? [] : [falta('quantidade')]),
    ];
  }
  return item.valorTotalCentavos == null ? [falta('valor')] : [];
}
