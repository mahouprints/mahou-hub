import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { VendaCreate, VendaUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { custosMlDaVenda } from '../financeiro/financeiro-calculo';

@Injectable()
export class VendasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista vendas, opcionalmente filtradas por mês competência (YYYY-MM).
   * Sempre incluindo produto+filamento pra UI exibir nome legível.
   */
  async list(mes?: string) {
    const where = mes ? { dataVenda: rangeDoMes(mes) } : {};
    const vendas = await this.prisma.venda.findMany({
      where,
      orderBy: { dataVenda: 'desc' },
      include: { produto: { include: { filamento: true } }, pedidoItem: true },
    });
    return vendas.map((venda) => ({ ...venda, custosMl: custosMlDaVenda(venda) }));
  }

  /**
   * "Vendi 12 azuis e 3 rosas" — agrupa as vendas do mês por variação.
   *
   * Serve pra decidir o que imprimir: cor que sai é cor que vale ter pronta na
   * prateleira. Venda de produto sem variação entra numa linha "sem cor definida" em vez
   * de sumir do relatório — some seria pior, porque o total não bateria com o financeiro.
   */
  async porVariacao(mes?: string) {
    const vendas = await this.prisma.venda.findMany({
      where: mes ? { dataVenda: rangeDoMes(mes) } : {},
      include: {
        produto: { select: { nome: true } },
        variacao: { select: { nome: true, sku: true } },
      },
    });

    const linhas = new Map<
      string,
      {
        produto: string;
        cor: string | null;
        sku: string | null;
        unidades: number;
        receitaCentavos: number;
      }
    >();

    for (const v of vendas) {
      const chave = v.variacaoId ?? `sem-variacao:${v.produtoId}`;
      const linha = linhas.get(chave) ?? {
        produto: v.produto.nome,
        cor: v.variacao?.nome ?? null,
        sku: v.variacao?.sku ?? null,
        unidades: 0,
        receitaCentavos: 0,
      };
      linha.unidades += v.qtd;
      linha.receitaCentavos += v.precoUnitarioCentavos * v.qtd;
      linhas.set(chave, linha);
    }

    return [...linhas.values()].sort((a, b) => b.unidades - a.unidades);
  }

  async get(id: string) {
    const v = await this.prisma.venda.findUnique({
      where: { id },
      include: { produto: { include: { filamento: true } }, pedidoItem: true },
    });
    if (!v) throw new NotFoundException(`Venda ${id} não existe`);
    return { ...v, custosMl: custosMlDaVenda(v) };
  }

  create(data: VendaCreate) {
    return this.prisma.venda.create({ data });
  }

  async update(id: string, data: VendaUpdate) {
    const venda = await this.prisma.venda.findUnique({
      where: { id },
      select: {
        pedidoItemId: true,
        produtoId: true,
        qtd: true,
        precoUnitarioCentavos: true,
        canal: true,
      },
    });
    if (!venda) throw new NotFoundException(`Venda ${id} não existe`);
    const camposDoPedido = ['produtoId', 'qtd', 'precoUnitarioCentavos', 'canal'] as const;
    if (
      venda.pedidoItemId &&
      camposDoPedido.some((campo) => data[campo] !== undefined && data[campo] !== venda[campo])
    ) {
      throw new BadRequestException(
        'Produto, quantidade, preço e canal de uma venda importada devem ser corrigidos no pedido de origem.',
      );
    }
    return this.prisma.venda.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.venda.delete({ where: { id } });
    return { ok: true };
  }

  /** Hard-delete em massa — vendas erradas precisam sumir do agregado. */
  async removeMuitos(ids: string[]) {
    const r = await this.prisma.venda.deleteMany({ where: { id: { in: ids } } });
    return { ok: true, count: r.count };
  }
}

/** Devolve { gte, lt } cobrindo o mês inteiro a partir de string YYYY-MM. */
function rangeDoMes(mes: string) {
  const [ano, mm] = mes.split('-').map(Number);
  if (!ano || !mm || mm < 1 || mm > 12) {
    throw new Error(`mes inválido: ${mes} (esperado YYYY-MM)`);
  }
  const gte = new Date(Date.UTC(ano, mm - 1, 1));
  const lt = new Date(Date.UTC(ano, mm, 1));
  return { gte, lt };
}
