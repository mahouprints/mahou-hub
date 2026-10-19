import { Prisma } from '@prisma/client';
import { calcularProduto, type CalculoEntrada } from '@mahou-hub/pricing';
import type { ResumoRelatorioFinanceiro, TotaisVendasRelatorio } from '@mahou-hub/contracts';
import { custosEfetivosDaVariacao } from '../produtos/custos-variacao';

export const VENDA_FINANCEIRA_INCLUDE = {
  pedidoItem: true,
  variacao: { include: { filamento: true } },
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
    ...custosEfetivosDaVariacao(produto, venda.variacao),
    impressora: produto.impressora,
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
  const custosMl = custosMlDaVenda(venda);
  // Importados são totais da linha (já incluem quantidade e eventual rateio de envio).
  // Sem despesa importada, o ML mostra somente o subtotal conhecido e mantém a pendência.
  const taxaCanal = custosMl
    ? (custosMl.tarifaCentavos ?? 0)
    : (taxas[venda.canal] ?? 0) * venda.qtd;
  const frete = custosMl?.freteCentavos ?? 0;
  const custosMlCompletos =
    custosMl?.tarifaFonte === 'IMPORTADA' && custosMl.freteFonte === 'IMPORTADO';
  return {
    faturamentoCentavos: faturamento,
    custosVariaveisCentavos: variaveis,
    custosInsumosCentavos: insumos * venda.qtd,
    impostosCentavos: impostos,
    taxasMarketplaceCentavos: taxaCanal,
    fretesCentavos: frete,
    vendasMlComCustosReais: custosMlCompletos ? 1 : 0,
    vendasMlComCustosPendentes: custosMl && !custosMlCompletos ? 1 : 0,
    lucroContribuicaoCentavos:
      faturamento - variaveis - insumos * venda.qtd - impostos - taxaCanal - frete,
    qtdVendas: 1,
    qtdItensVendidos: venda.qtd,
  };
}

/** Zero importado é conhecido; ausência de frete mantém o resultado sinalizado como parcial. */
export function custosMlDaVenda(venda: {
  canal: string;
  qtd: number;
  precoUnitarioCentavos: number;
  pedidoItem?: {
    qtd: number;
    precoUnitarioCentavos: number;
    tarifaMlCentavos: number | null;
    freteMlCentavos: number | null;
    custosMlAtualizadosEm: Date | null;
  } | null;
}) {
  if (venda.canal !== 'ML') return null;
  // Edições antigas podem ter alterado a venda sem alterar o item importado.
  const item =
    venda.pedidoItem?.qtd === venda.qtd &&
    venda.pedidoItem.precoUnitarioCentavos === venda.precoUnitarioCentavos
      ? venda.pedidoItem
      : null;
  return {
    tarifaCentavos: item?.tarifaMlCentavos ?? null,
    freteCentavos: item?.freteMlCentavos ?? null,
    tarifaFonte: item?.tarifaMlCentavos != null ? ('IMPORTADA' as const) : ('PENDENTE' as const),
    freteFonte: item?.freteMlCentavos != null ? ('IMPORTADO' as const) : ('PENDENTE' as const),
    atualizadosEm: item?.custosMlAtualizadosEm?.toISOString() ?? null,
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
    fretesCentavos: 0,
    vendasMlComCustosReais: 0,
    vendasMlComCustosPendentes: 0,
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
