// Normalização de `sales` da Shopee Affiliate API pra base mensal.
//
// Provenance: Shopee Affiliate só expõe `sales` da janela de campanha (~30 dias),
// não o histórico total. O número que sai daqui é o **sales do afiliado**
// normalizado por janela — NÃO uma estimativa de vendas totais.
//
// Decisão (2026-05-23): paramos de inflar com `1/0.05` (heurística de "5% via
// afiliado") porque o resultado era contraintuitivo e dependia de uma média
// observada em poucas lojas. UI mostra agora "Vendas (afiliado)" e mantém um
// campo separado `vendasReais` (nullable) pra enriquecimento manual futuro.

/**
 * @deprecated Mantido pra compatibilidade. Não use em código novo —
 * o pipeline atual não infere vendas totais a partir do sales do afiliado.
 */
export const TAXA_AFILIADO_SHOPEE = 0.05;

export type ProdutoComVendasShopee = {
  sales: number;
  periodStartTime: Date | string;
  periodEndTime: Date | string;
};

/**
 * Normaliza `sales` da Shopee Affiliate pra base mensal de 30 dias.
 *
 * `sales` vem com janela de campanha variável (ex.: 14 dias, 28 dias, 35 dias).
 * Pra comparar lojas com janelas diferentes, normalizamos pra 30 dias.
 * Quando a janela é inválida ou zero-divisão, retorna `sales` direto.
 *
 * @example
 *   normalizarVendasAfiliadoMes({ sales: 449, periodStartTime: '2026-04-20', periodEndTime: '2026-05-20' })
 *   // → 449  (janela ~30 dias, sem ajuste)
 *
 *   normalizarVendasAfiliadoMes({ sales: 200, periodStartTime: '2026-04-20', periodEndTime: '2026-05-04' })
 *   // → 429  (janela 14 dias → projeção pra 30: 200/14*30)
 */
export function normalizarVendasAfiliadoMes(produto: ProdutoComVendasShopee): number {
  const inicio =
    produto.periodStartTime instanceof Date
      ? produto.periodStartTime.getTime()
      : new Date(produto.periodStartTime).getTime();
  const fim =
    produto.periodEndTime instanceof Date
      ? produto.periodEndTime.getTime()
      : new Date(produto.periodEndTime).getTime();
  const diasJanela = (fim - inicio) / 86_400_000;
  const salesNoMes =
    Number.isFinite(diasJanela) && diasJanela > 0
      ? (produto.sales / diasJanela) * 30
      : produto.sales;
  return Math.round(salesNoMes);
}

/** Soma `normalizarVendasAfiliadoMes` de uma lista de produtos da mesma loja. */
export function somarVendasAfiliadoMes(produtos: readonly ProdutoComVendasShopee[]): number {
  return produtos.reduce((acc, p) => acc + normalizarVendasAfiliadoMes(p), 0);
}

// ─── aliases @deprecated (compat) ────────────────────────────────────────────
// Mantidos pra não quebrar imports de fora do monorepo. Internamente já é tudo
// o novo nome. Remover quando confirmar que nenhum consumer externo depende.

/** @deprecated Renomeado pra `normalizarVendasAfiliadoMes`. */
export const estimarVendasTotaisMes = normalizarVendasAfiliadoMes;

/** @deprecated Renomeado pra `somarVendasAfiliadoMes`. */
export const somarVendasEstimadasMes = somarVendasAfiliadoMes;
