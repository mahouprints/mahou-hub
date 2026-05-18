import { Injectable, NotFoundException } from '@nestjs/common';
import {
  calcularProduto,
  type FaixaMercadoLivre as FaixaMlPricing,
  type FaixaShopee as FaixaShopeePricing,
  type ParametrosGlobais,
} from '@mahou-hub/pricing';
import type { ResumoFinanceiro } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula o resumo financeiro de um mês competência (formato YYYY-MM).
   * - Faturamento = soma(preço unit × qtd) das vendas do mês
   * - Custos variáveis = soma do custo de produção dos itens vendidos
   * - Impostos + taxas = derivados via calcularProduto() reusando o preço real da venda
   * - Custos gerais = soma dos Custo do mês competência
   * - Lucro líquido = faturamento - variáveis - impostos - taxas - gerais
   */
  async resumoMensal(mes: string): Promise<ResumoFinanceiro> {
    const { gte, lt } = rangeDoMes(mes);

    const vendas = await this.prisma.venda.findMany({
      where: { dataVenda: { gte, lt } },
      include: {
        produto: {
          include: { filamento: true, insumos: { include: { insumo: true } } },
        },
      },
    });

    const parametros = await this.carregarParametros();
    const tabelaShopee = await this.carregarTabelaShopee();
    const tabelaMl = await this.carregarTabelaMl();

    const acc: ResumoFinanceiro = {
      mes,
      faturamentoCentavos: 0,
      custosVariaveisCentavos: 0,
      custosInsumosCentavos: 0,
      custosGeraisCentavos: 0,
      impostosCentavos: 0,
      taxasMarketplaceCentavos: 0,
      lucroLiquidoCentavos: 0,
      margem: 0,
      porCanal: { SHOPEE: 0, ML: 0, SITE: 0, TIKTOK: 0 },
      qtdVendas: vendas.length,
      qtdItensVendidos: 0,
    };

    for (const v of vendas) {
      // Custo unitário dos insumos cadastrados no produto (caixa, fita etc).
      // Mantemos separado dos custos variáveis (filamento+energia+embalagem)
      // pra exibir como métrica própria no dashboard. Soma ainda entra no
      // pricing pra margem/líquido refletirem o custo total real.
      const custoInsumosUnit = somarCustoInsumosProduto(v.produto.insumos);

      const calc = calcularProduto({
        pesoG: Number(v.produto.pesoG),
        tempoH: Number(v.produto.tempoH),
        impressora: v.produto.impressora,
        filamento: {
          nome: v.produto.filamento.nome,
          custoKgCentavos: v.produto.filamento.custoKgCentavos,
          potenciaA1W: v.produto.filamento.potenciaA1W,
          potenciaH2cW: v.produto.filamento.potenciaH2cW,
        },
        embalagemCentavos: v.produto.embalagemCentavos,
        custoInsumosCentavos: custoInsumosUnit,
        precoCentavos: v.precoUnitarioCentavos, // preço REAL da venda
        parametros,
        tabelaShopee,
        tabelaMercadoLivre: tabelaMl,
      });

      const fatVenda = v.precoUnitarioCentavos * v.qtd;
      const taxaCanal =
        v.canal === 'SHOPEE'
          ? calc.taxaShopeeCentavos
          : v.canal === 'ML'
            ? calc.taxaMlCentavos
            : v.canal === 'TIKTOK'
              ? calc.taxaTikTokCentavos
              : 0;

      // custoTotalProducao já inclui insumos — subtraímos pra não duplicar.
      const custoVariavelUnit = calc.custoTotalProducaoCentavos - custoInsumosUnit;

      acc.faturamentoCentavos += fatVenda;
      acc.custosVariaveisCentavos += custoVariavelUnit * v.qtd;
      acc.custosInsumosCentavos += custoInsumosUnit * v.qtd;
      acc.impostosCentavos += calc.impostoCentavos * v.qtd;
      acc.taxasMarketplaceCentavos += taxaCanal * v.qtd;
      acc.porCanal[v.canal] += fatVenda;
      acc.qtdItensVendidos += v.qtd;
    }

    const custos = await this.prisma.custo.findMany({
      where: { dataCompetencia: { gte, lt } },
    });
    acc.custosGeraisCentavos = custos.reduce((s, c) => s + c.valorCentavos, 0);

    acc.lucroLiquidoCentavos =
      acc.faturamentoCentavos -
      acc.custosVariaveisCentavos -
      acc.custosInsumosCentavos -
      acc.impostosCentavos -
      acc.taxasMarketplaceCentavos -
      acc.custosGeraisCentavos;

    acc.margem = acc.faturamentoCentavos > 0 ? acc.lucroLiquidoCentavos / acc.faturamentoCentavos : 0;

    return acc;
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

function somarCustoInsumosProduto(
  insumos: Array<{ qtd: { toString(): string }; insumo: { custoUnitarioCentavos: number } }>,
): number {
  return insumos.reduce(
    (acc, pi) => acc + Math.round(Number(pi.qtd) * pi.insumo.custoUnitarioCentavos),
    0,
  );
}

function rangeDoMes(mes: string) {
  const [ano, mm] = mes.split('-').map(Number);
  if (!ano || !mm || mm < 1 || mm > 12) {
    throw new Error(`mes inválido: ${mes} (esperado YYYY-MM)`);
  }
  return {
    gte: new Date(Date.UTC(ano, mm - 1, 1)),
    lt: new Date(Date.UTC(ano, mm, 1)),
  };
}
