// Estimativa de vendas TOTAIS de produtos Shopee a partir do dado `sales`
// devolvido pela Affiliate API.
//
// Provenance: Shopee Affiliate só expõe `sales` da janela de campanha (~30 dias),
// não o histórico total. Amostragem em 6 produtos da 3DTECH (2026-05) mostrou
// que `sales` corresponde a ~5% das vendas reais (ratios 1.6% a 7.3%, média ~5%).
// Sem outra fonte viável (Affiliate só tem 19 campos, /pdp/get_pc bloqueado por
// x-sap-sec stateful) — essa é a aproximação que dá pro MVP do módulo Concorrentes.

export const TAXA_AFILIADO_SHOPEE = 0.05;

export type ProdutoComVendasShopee = {
  sales: number;
  periodStartTime: Date | string;
  periodEndTime: Date | string;
};

/**
 * Estima vendas totais mensais a partir de `sales` da Shopee Affiliate.
 *
 * 1. Normaliza `sales` (vendas via afiliado na janela de campanha) pra base mensal.
 * 2. Divide pela taxa estimada de afiliado → vendas totais (incl. orgânicas).
 *
 * @example
 *   estimarVendasTotaisMes({ sales: 449, periodStartTime: '2026-04-20', periodEndTime: '2026-05-20' })
 *   // → ~8980 (449 / 30 * 30 / 0.05)
 */
export function estimarVendasTotaisMes(produto: ProdutoComVendasShopee): number {
  const inicio = produto.periodStartTime instanceof Date
    ? produto.periodStartTime.getTime()
    : new Date(produto.periodStartTime).getTime();
  const fim = produto.periodEndTime instanceof Date
    ? produto.periodEndTime.getTime()
    : new Date(produto.periodEndTime).getTime();
  const diasJanela = (fim - inicio) / 86_400_000;
  const salesNoMes = Number.isFinite(diasJanela) && diasJanela > 0
    ? (produto.sales / diasJanela) * 30
    : produto.sales;
  return Math.round(salesNoMes / TAXA_AFILIADO_SHOPEE);
}

/** Soma a estimativa mensal de uma lista de produtos da mesma loja. */
export function somarVendasEstimadasMes(produtos: readonly ProdutoComVendasShopee[]): number {
  return produtos.reduce((acc, p) => acc + estimarVendasTotaisMes(p), 0);
}
