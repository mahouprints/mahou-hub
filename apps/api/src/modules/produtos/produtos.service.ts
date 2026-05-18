import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class ProdutosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagens: ImagensService,
  ) {}

  /**
   * Lista produtos com pricing já calculado. Filtros opcionais:
   * - `anunciado`: false retorna só pendentes (fluxo de geração de imagem
   *   consume isso pra processar só o que ainda não foi publicado)
   */
  async list(filtros?: { anunciado?: boolean }) {
    const produtos = await this.prisma.produto.findMany({
      where: {
        ativo: true,
        ...(filtros?.anunciado != null ? { anunciado: filtros.anunciado } : {}),
      },
      orderBy: { criadoEm: 'desc' },
      include: {
        filamento: true,
        insumos: { include: { insumo: true } },
        imagens: { orderBy: { ordem: 'asc' } },
      },
    });
    if (produtos.length === 0) return [];

    const parametros = await this.carregarParametros();
    const tabelaShopee = await this.carregarTabelaShopee();
    const tabelaMl = await this.carregarTabelaMl();

    return produtos.map((p) => ({
      ...p,
      pesoG: Number(p.pesoG),
      tempoH: Number(p.tempoH),
      custoInsumosCentavos: somarCustoInsumos(p.insumos),
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
        custoInsumosCentavos: somarCustoInsumos(p.insumos),
        precoCentavos: p.precoCentavos,
        parametros,
        tabelaShopee,
        tabelaMercadoLivre: tabelaMl,
      }),
    }));
  }

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
    return { ...p, imagens: p.imagens.map((img) => this.imagens.paraDto(img)) };
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

export type ProdutoComPricing = Awaited<ReturnType<ProdutosService['list']>>[number];
export type { CalculoSaida };

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
