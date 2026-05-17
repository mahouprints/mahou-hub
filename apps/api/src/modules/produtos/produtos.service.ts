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

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista produtos com o breakdown completo de pricing já calculado. */
  async list() {
    const produtos = await this.prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { criadoEm: 'desc' },
      include: { filamento: true },
    });
    if (produtos.length === 0) return [];

    const parametros = await this.carregarParametros();
    const tabelaShopee = await this.carregarTabelaShopee();
    const tabelaMl = await this.carregarTabelaMl();

    return produtos.map((p) => ({
      ...p,
      pesoG: Number(p.pesoG),
      tempoH: Number(p.tempoH),
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
      include: { filamento: true },
    });
    if (!p) throw new NotFoundException(`Produto ${id} não existe`);
    return p;
  }

  create(data: ProdutoCreate) {
    return this.prisma.produto.create({ data });
  }

  update(id: string, data: ProdutoUpdate) {
    return this.prisma.produto.update({ where: { id }, data });
  }

  async desativar(id: string) {
    await this.prisma.produto.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
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
