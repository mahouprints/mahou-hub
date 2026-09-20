import { Prisma } from '@prisma/client';
import { calcularProduto, type CalculoEntrada } from '@mahou-hub/pricing';
import type { ResumoRelatorioFinanceiro, TotaisVendasRelatorio } from '@mahou-hub/contracts';

export const VENDA_FINANCEIRA_INCLUDE = {
  produto: {
    include: {
      filamento: true,
      filamentos: { include: { filamento: true } },
      insumos: { include: { insumo: true } },
    },
  },
} satisfies Prisma.VendaInclude;
export type VendaFinanceira = Prisma.VendaGetPayload<{ include: typeof VENDA_FINANCEIRA_INCLUDE }>;
export type ContextoFinanceiro = Pick<
  CalculoEntrada,
  'parametros' | 'tabelaShopee' | 'tabelaMercadoLivre'
>;

/** Mantém o custo atual do cadastro e o preço efetivamente vendido; ex.: duas peças multiplicam cada custo unitário. */
export function calcularVendaFinanceira(
  venda: VendaFinanceira,
  contexto: ContextoFinanceiro,
): TotaisVendasRelatorio {
  const produto = venda.produto;
  const insumos = produto.insumos.reduce(
    (total, linha) => total + Math.round(Number(linha.qtd) * linha.insumo.custoUnitarioCentavos),
    0,
  );
  const calculado = calcularProduto({
    ...contexto,
    pesoG: Number(produto.pesoG),
    tempoH: Number(produto.tempoH),
    impressora: produto.impressora,
    filamento: produto.filamento,
    filamentos: produto.filamentos.map((linha) => ({
      pesoG: Number(linha.pesoG),
      filamento: linha.filamento,
    })),
    embalagemCentavos: produto.embalagemCentavos,
    custoInsumosCentavos: insumos,
    precoCentavos: venda.precoUnitarioCentavos,
  });
  const taxas = {
    SITE: 0,
    SHOPEE: calculado.taxaShopeeCentavos,
    ML: calculado.taxaMlCentavos,
    TIKTOK: calculado.taxaTikTokCentavos,
  };
  const faturamento = venda.precoUnitarioCentavos * venda.qtd;
  const variaveis = (calculado.custoTotalProducaoCentavos - insumos) * venda.qtd;
  const impostos = calculado.impostoCentavos * venda.qtd;
  const taxaCanal = taxas[venda.canal] * venda.qtd;
  return {
    faturamentoCentavos: faturamento,
    custosVariaveisCentavos: variaveis,
    custosInsumosCentavos: insumos * venda.qtd,
    impostosCentavos: impostos,
    taxasMarketplaceCentavos: taxaCanal,
    lucroContribuicaoCentavos: faturamento - variaveis - insumos * venda.qtd - impostos - taxaCanal,
    qtdVendas: 1,
    qtdItensVendidos: venda.qtd,
  };
}

/** Soma sem recalcular arredondamentos por grupo; ex.: canal e período conciliam com cada venda. */
export function somarValoresVendas(vendas: TotaisVendasRelatorio[]): TotaisVendasRelatorio {
  const soma: TotaisVendasRelatorio = {
    faturamentoCentavos: 0,
    custosVariaveisCentavos: 0,
    custosInsumosCentavos: 0,
    impostosCentavos: 0,
    taxasMarketplaceCentavos: 0,
    lucroContribuicaoCentavos: 0,
    qtdVendas: 0,
    qtdItensVendidos: 0,
  };
  for (const venda of vendas) {
    for (const campo of Object.keys(soma) as Array<keyof TotaisVendasRelatorio>)
      soma[campo] += venda[campo];
  }
  return soma;
}

/** Desconta gerais uma única vez, além do custo reconhecido nas vendas; ex.: compra de rolo não é consultada. */
export function resumirFinanceiro(
  vendas: Array<{ canal: VendaFinanceira['canal']; valores: TotaisVendasRelatorio }>,
  custos: Array<{ valorCentavos: number }>,
): ResumoRelatorioFinanceiro {
  const { lucroContribuicaoCentavos, ...totais } = somarValoresVendas(vendas.map((v) => v.valores));
  const custosGeraisCentavos = custos.reduce((total, custo) => total + custo.valorCentavos, 0);
  const lucroLiquidoCentavos = lucroContribuicaoCentavos - custosGeraisCentavos;
  const porCanal = { SHOPEE: 0, ML: 0, SITE: 0, TIKTOK: 0 };
  for (const venda of vendas) porCanal[venda.canal] += venda.valores.faturamentoCentavos;
  return {
    ...totais,
    custosGeraisCentavos,
    lucroLiquidoCentavos,
    porCanal,
    gastosTotaisCentavos: totais.faturamentoCentavos - lucroLiquidoCentavos,
    margem: totais.faturamentoCentavos > 0 ? lucroLiquidoCentavos / totais.faturamentoCentavos : 0,
  };
}
