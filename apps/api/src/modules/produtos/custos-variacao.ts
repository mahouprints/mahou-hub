import type { Filamento } from '@mahou-hub/pricing';

type NumeroCadastrado = number | { toString(): string };
type ProdutoComCustos = {
  pesoG: NumeroCadastrado;
  tempoH: NumeroCadastrado;
  precoCentavos: number;
  filamento: Filamento;
  filamentos?: Array<{ pesoG: NumeroCadastrado; filamento: Filamento }>;
};
type VariacaoComCustos = {
  filamentoId?: string | null;
  filamento?: Filamento | null;
  pesoG?: NumeroCadastrado | null;
  tempoH?: NumeroCadastrado | null;
  precoCentavos?: number | null;
};

/** Resolve a cor na receita inteira; ex.: azul substitui branco também no custo dos 13 g. */
export function custosEfetivosDaVariacao(
  produto: ProdutoComCustos,
  variacao?: VariacaoComCustos | null,
) {
  const receita = produto.filamentos ?? [];
  const monocromatico = receita.length <= 1;
  const pesoBase = receita[0]?.pesoG ?? produto.pesoG;
  const pesoG = Number(monocromatico ? (variacao?.pesoG ?? pesoBase) : produto.pesoG);
  const filamento = monocromatico
    ? (variacao?.filamento ?? receita[0]?.filamento ?? produto.filamento)
    : produto.filamento;
  return {
    pesoG,
    tempoH: Number(variacao?.tempoH ?? produto.tempoH),
    precoCentavos: variacao?.precoCentavos ?? produto.precoCentavos,
    filamento,
    filamentos: monocromatico
      ? [{ pesoG, filamento }]
      : receita.map((item) => ({ pesoG: Number(item.pesoG), filamento: item.filamento })),
  };
}

/** Não apresenta margem de uma variação que a produção recusaria por receita ambígua. */
export function pendenciasComposicaoVariacao(
  produto: ProdutoComCustos,
  variacao: VariacaoComCustos,
): string[] {
  const receita = produto.filamentos ?? [];
  if (receita.length <= 1) return [];
  const pesoReceita = Math.round(
    receita.reduce((soma, item) => soma + Number(item.pesoG), 0) * 100,
  );
  const pesoDiferente =
    variacao.pesoG != null && Math.round(Number(variacao.pesoG) * 100) !== pesoReceita;
  return variacao.filamentoId || pesoDiferente
    ? ['A variação deve herdar os filamentos e o peso da composição com vários materiais.']
    : [];
}
