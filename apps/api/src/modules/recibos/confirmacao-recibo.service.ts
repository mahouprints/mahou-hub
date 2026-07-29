import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { detectarNotaDuplicada } from './detectar-nota-duplicada';

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

    await this.recusarSeJaLancada(recibo);

    for (const item of recibo.itens) {
      if (item.movimentoRegistrado) continue;
      await this.aplicarItem(item, recibo.fornecedor, recibo.data, recibo.id);
    }

    await this.prisma.recibo.update({
      where: { id: reciboId },
      data: { status: 'CONFIRMADO', confirmadoEm: new Date() },
    });
    return this.comItens(reciboId);
  }

  /**
   * Recusa confirmar quando a MESMA nota já lançou estoque num outro recibo.
   *
   * A checagem é refeita aqui, e não só na leitura, porque entre ler e confirmar o Gabriel
   * pode ter lançado a nota gêmea em outra aba. Só identidade forte (chave da NF-e, ou
   * número + CNPJ) bloqueia; semelhança de fornecedor/data/valor vira aviso na tela, já que
   * duas compras iguais no mesmo dia são possíveis.
   */
  private async recusarSeJaLancada(recibo: {
    id: string;
    chaveNfe: string | null;
    numeroNota: string | null;
    cnpjEmitente: string | null;
    fornecedor: string | null;
    valorCentavos: number | null;
    data: Date;
  }) {
    const outros = await this.prisma.recibo.findMany({
      where: { id: { not: recibo.id } },
      select: {
        id: true,
        status: true,
        chaveNfe: true,
        numeroNota: true,
        cnpjEmitente: true,
        fornecedor: true,
        valorCentavos: true,
        data: true,
      },
    });
    const duplicata = detectarNotaDuplicada(recibo, outros);
    if (duplicata?.nivel !== 'FORTE' || !duplicata.jaLancado) return;

    throw new BadRequestException(
      'Esta nota já foi lançada no estoque em outro recibo — confirmar de novo duplicaria o saldo. ' +
        'Se forem compras diferentes, corrija o número da nota antes de confirmar.',
    );
  }

  /**
   * Um item por vez, cada um marcando `movimentoRegistrado` logo depois de aplicar.
   *
   * Sem transação cobrindo o recibo inteiro de propósito: `EstoqueService.registrarMovimento`
   * já abre a sua, e Prisma não aninha. Se der erro no meio, o que entrou fica marcado e
   * reconfirmar retoma dos que faltaram, em vez de duplicar os que já entraram.
   */
  private async aplicarItem(
    item: ItemDoRecibo,
    fornecedor: string | null,
    data: Date,
    reciboId: string,
  ) {
    // Começa com "Nota de compra" porque essa coluna é lida no histórico do estoque, onde
    // o que importa é saber de onde o saldo veio sem precisar abrir nada.
    const observacao =
      `Nota de compra${fornecedor ? ` — ${fornecedor}` : ''} — ${item.descricaoNota}`.slice(0, 500);

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
        reciboId,
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
