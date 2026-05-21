import { Injectable, NotFoundException } from '@nestjs/common';
import { Canal, Prisma } from '@prisma/client';
import {
  calcularProduto,
  type CalculoSaida,
  type FaixaMercadoLivre as FaixaMlPricing,
  type FaixaShopee as FaixaShopeePricing,
  type ParametrosGlobais,
} from '@mahou-hub/pricing';
import type { ProdutoCreate, ProdutoUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { ImagensService } from '../imagens/imagens.service';

export type ProdutoListSortBy = 'criadoEm' | 'atualizadoEm' | 'nome' | 'precoCentavos';
export type ProdutoListSortDir = 'asc' | 'desc';
export type ProdutoListOpts = {
  anunciado?: boolean;
  canal?: Canal;
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: ProdutoListSortBy;
  sortDir?: ProdutoListSortDir;
};

@Injectable()
export class ProdutosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagens: ImagensService,
  ) {}

  /**
   * Lista produtos com pricing já calculado. Filtros e paginação opcionais.
   *
   * Sem `page`/`pageSize` devolve todos os produtos que casam — comportamento
   * histórico que o frontend e o fluxo de geração de imagem dependem.
   * Com paginação, o consumer faz N requests menores e usa `total` pra saber
   * quando parar.
   */
  async list(opts?: ProdutoListOpts) {
    const { anunciado, canal, q, page, pageSize, sortBy = 'criadoEm', sortDir = 'desc' } = opts ?? {};
    const where = {
      ativo: true,
      ...(anunciado != null ? { anunciado } : {}),
      ...(canal ? { canalPrincipal: canal } : {}),
      ...(q && q.trim()
        ? {
            OR: [
              { nome: { contains: q, mode: 'insensitive' as const } },
              { inspiracao: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const skip = page != null && pageSize != null ? (page - 1) * pageSize : undefined;
    const take = pageSize ?? undefined;

    const [produtos, total] = await Promise.all([
      this.prisma.produto.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip,
        take,
        include: {
          filamento: true,
          insumos: { include: { insumo: true } },
          imagens: { orderBy: { ordem: 'asc' } },
        },
      }),
      this.prisma.produto.count({ where }),
    ]);

    if (produtos.length === 0) return { items: [], total };
    const items = await this.enriquecerComPricing(produtos);
    return { items, total };
  }

  /**
   * Detalha 1 produto já com pricing calculado — mesma forma do `list()`.
   * Antes (≤2026-05-21) este endpoint devolvia o produto cru, e o frontend chamava
   * `/pricing/calcular` em separado pra ter o pricing; consumers externos (MCP, n8n)
   * ficavam sem. Agora a forma do payload bate entre `list` e `get`.
   */
  async get(id: string) {
    const p = await this.prisma.produto.findUnique({
      where: { id },
      include: {
        filamento: true,
        insumos: { include: { insumo: true } },
        imagens: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException(`Produto ${id} não existe`);
    const [enriquecido] = await this.enriquecerComPricing([p]);
    return enriquecido;
  }

  async create(data: ProdutoCreate) {
    const { insumos, ...resto } = data;
    return this.prisma.produto.create({
      data: {
        ...resto,
        insumos: insumos?.length
          ? { create: insumos.map((i) => ({ insumoId: i.insumoId, qtd: i.qtd })) }
          : undefined,
      },
      include: { insumos: { include: { insumo: true } } },
    });
  }

  /**
   * Update faz delete-and-recreate dos ProdutoInsumo quando `insumos` vem no payload.
   * Se `insumos` não vier, lista atual é preservada.
   */
  async update(id: string, data: ProdutoUpdate) {
    const { insumos, ...resto } = data;
    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.produto.update({ where: { id }, data: resto });
      if (insumos !== undefined) {
        await tx.produtoInsumo.deleteMany({ where: { produtoId: id } });
        if (insumos.length > 0) {
          await tx.produtoInsumo.createMany({
            data: insumos.map((i) => ({ produtoId: id, insumoId: i.insumoId, qtd: i.qtd })),
          });
        }
      }
      return atualizado;
    });
  }

  async desativar(id: string) {
    await this.prisma.produto.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  }

  /** Soft-delete em massa (ativo=false) — preserva histórico de vendas. */
  async desativarMuitos(ids: string[]) {
    const r = await this.prisma.produto.updateMany({
      where: { id: { in: ids } },
      data: { ativo: false },
    });
    return { ok: true, count: r.count };
  }

  /**
   * Marca/desmarca produtos como anunciados em massa. Útil pro fluxo externo
   * de geração de imagem confirmar publicações em batch.
   */
  async marcarAnunciados(ids: string[], anunciado: boolean) {
    const r = await this.prisma.produto.updateMany({
      where: { id: { in: ids } },
      data: { anunciado },
    });
    return { ok: true, count: r.count };
  }

  /**
   * Estatísticas agregadas pra exibir no detalhe do produto:
   * - vendidos = soma de qtd nas Vendas
   * - faturamentoCentavos = soma de preço × qtd nas Vendas
   * - produzidos = soma de qtd nos JobProducao com status terminal (CONCLUIDO/EMBALADO/ENVIADO)
   * - emProducao = soma nos status ativos (FILA/IMPRIMINDO)
   * - ultimaVendaEm = data da venda mais recente, ou null
   */
  async estatisticas(id: string) {
    const existe = await this.prisma.produto.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException(`Produto ${id} não existe`);

    const vendasAgg = await this.prisma.venda.aggregate({
      where: { produtoId: id },
      _sum: { qtd: true },
      _count: { _all: true },
    });

    const vendas = await this.prisma.venda.findMany({
      where: { produtoId: id },
      select: { precoUnitarioCentavos: true, qtd: true, dataVenda: true },
      orderBy: { dataVenda: 'desc' },
    });

    const faturamentoCentavos = vendas.reduce(
      (s, v) => s + v.precoUnitarioCentavos * v.qtd,
      0,
    );
    const ultimaVendaEm = vendas[0]?.dataVenda ?? null;

    const produzidos = await this.prisma.jobProducao.aggregate({
      where: { produtoId: id, status: { in: ['CONCLUIDO', 'EMBALADO', 'ENVIADO'] } },
      _sum: { qtd: true },
    });

    const emProducao = await this.prisma.jobProducao.aggregate({
      where: { produtoId: id, status: { in: ['FILA', 'IMPRIMINDO'] } },
      _sum: { qtd: true },
    });

    return {
      vendidos: vendasAgg._sum.qtd ?? 0,
      qtdVendas: vendasAgg._count._all,
      faturamentoCentavos,
      ultimaVendaEm,
      produzidos: produzidos._sum.qtd ?? 0,
      emProducao: emProducao._sum.qtd ?? 0,
    };
  }

  /**
   * Calcula pricing pra uma lista de produtos. Carrega Parametro+tabelas 1x e
   * aplica em todos (evita N+1). Usado por `list()` e `get()` pra garantir que
   * a forma do payload é a mesma nos dois endpoints.
   */
  private async enriquecerComPricing(produtos: ProdutoComIncludes[]) {
    const [parametros, tabelaShopee, tabelaMl] = await Promise.all([
      this.carregarParametros(),
      this.carregarTabelaShopee(),
      this.carregarTabelaMl(),
    ]);
    return produtos.map((p) => {
      const custoInsumos = somarCustoInsumos(p.insumos);
      return {
        ...p,
        pesoG: Number(p.pesoG),
        tempoH: Number(p.tempoH),
        custoInsumosCentavos: custoInsumos,
        imagens: p.imagens.map((img) => this.imagens.paraDto(img)),
        pricing: calcularProduto({
          pesoG: Number(p.pesoG),
          tempoH: Number(p.tempoH),
          impressora: p.impressora,
          filamento: {
            nome: p.filamento.nome,
            custoKgCentavos: p.filamento.custoKgCentavos,
            potenciaA1W: p.filamento.potenciaA1W,
            potenciaH2cW: p.filamento.potenciaH2cW,
          },
          embalagemCentavos: p.embalagemCentavos,
          custoInsumosCentavos: custoInsumos,
          precoCentavos: p.precoCentavos,
          parametros,
          tabelaShopee,
          tabelaMercadoLivre: tabelaMl,
        }),
      };
    });
  }

  private async carregarParametros(): Promise<ParametrosGlobais> {
    const p = await this.prisma.parametro.findUnique({ where: { id: 1 } });
    if (!p) throw new NotFoundException('Parâmetros não inicializados');
    return {
      tarifaKwhCentavos: p.tarifaKwhCentavos,
      vendedorShopee: p.vendedorShopee,
      emCampanhaShopee: p.emCampanhaShopee,
      adicionalCampanhaPct: Number(p.adicionalCampanhaPct),
      comissaoMlPct: Number(p.comissaoMlPct),
      impostoAtivo: p.impostoAtivo,
      impostoPct: Number(p.impostoPct),
      tiktokComissaoPlataformaPct: Number(p.tiktokComissaoPlataformaPct),
      tiktokTaxaSfpPct: Number(p.tiktokTaxaSfpPct),
      tiktokComissaoAfiliadoPct: Number(p.tiktokComissaoAfiliadoPct),
      tiktokTaxaPagamentoPct: Number(p.tiktokTaxaPagamentoPct),
    };
  }

  private async carregarTabelaShopee(): Promise<FaixaShopeePricing[]> {
    const rows = await this.prisma.taxaShopee.findMany({
      orderBy: { limInferiorCentavos: 'asc' },
    });
    return rows.map((r) => ({
      limInferiorCentavos: r.limInferiorCentavos,
      comissaoPct: Number(r.comissaoPct),
      fixaCnpjCentavos: r.fixaCnpjCentavos,
      fixaCpfBaixoCentavos: r.fixaCpfBaixoCentavos,
      fixaCpfAltoCentavos: r.fixaCpfAltoCentavos,
    }));
  }

  private async carregarTabelaMl(): Promise<FaixaMlPricing[]> {
    const rows = await this.prisma.taxaMercadoLivre.findMany({
      orderBy: { limInferiorCentavos: 'asc' },
    });
    return rows.map((r) => ({
      faixa: r.faixa as 'A' | 'B' | 'C' | 'D' | 'E',
      limInferiorCentavos: r.limInferiorCentavos,
      custoFixoCentavos: r.custoFixoCentavos,
      pctAlternativo: Number(r.pctAlternativo),
      comissaoCategoriaPct: Number(r.comissaoCategoriaPct),
    }));
  }
}

export type ProdutoComPricing = Awaited<ReturnType<ProdutosService['list']>>['items'][number];
export type { CalculoSaida };

// Shape do produto com todos os includes que list/get carregam.
// Derivado do Prisma payload pra ficar sincronizado se o include mudar.
type ProdutoComIncludes = Prisma.ProdutoGetPayload<{
  include: {
    filamento: true;
    insumos: { include: { insumo: true } };
    imagens: true;
  };
}>;

/**
 * Soma dos insumos consumidos pelo produto (em centavos).
 * `qtd` vem como Decimal do Prisma; conversão via Number tolera precisão usual.
 */
function somarCustoInsumos(
  insumos: Array<{ qtd: { toString(): string }; insumo: { custoUnitarioCentavos: number } }>,
): number {
  return insumos.reduce(
    (acc, pi) => acc + Math.round(Number(pi.qtd) * pi.insumo.custoUnitarioCentavos),
    0,
  );
}
