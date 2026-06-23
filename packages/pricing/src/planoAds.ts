import type { DegrauEscala, ParamsAds, PlanoAdsEntrada, PlanoAdsSaida } from './types';
import { arredondarCentavos } from './money';

/**
 * Defaults de anúncio (jul/2026) — reproduzem o caso de referência do prompt.
 * CPC médio = observado na conta Shopee Ads da Mahou; retorno = devoluções médias.
 * Ficam no Parametro singleton (tunáveis); aqui é o fallback do pacote.
 */
export const PARAMS_ADS_PADRAO: ParamsAds = {
  cpcMedioCentavos: 50,
  taxaRetornoPct: 8,
  janelaTesteDias: 5,
  nivelConfianca: 95,
  fatorMargemEscala: 1.4,
  passoIncrementoPct: 25,
  cadenciaIncrementoDias: 3,
  nDegraus: 5,
  budgetDiarioMinimoCentavos: null,
  tetoBudgetDiarioCentavos: null,
};

/** Abaixo disso a amostra é fraca demais pra concluir o teste com confiança. */
const CLIQUES_MINIMO_CONFIAVEL = 60;

/**
 * Margem de contribuição bruta no caminho chapado (override/hipotético da Calculadora):
 * preço − cmv − taxa% do marketplace. No app real, passe o líquido de `calcularProduto`.
 */
export function margemContribuicaoBrutaCentavos(
  precoCentavos: number,
  cmvCentavos: number,
  taxaPct: number,
): number {
  const taxa = arredondarCentavos(precoCentavos * (taxaPct / 100));
  return precoCentavos - cmvCentavos - taxa;
}

/**
 * Calcula o plano de anúncios (Teste + Escalonamento) a partir da economia do produto.
 *
 * Modelo do Teste: em break-even, a probabilidade de 0 vendas segue Poisson
 * `P(0|λ=k) = e^-k = 1-confiança` → `k = -ln(1-confiança)`. Usamos `round(k)` como
 * "vendas esperadas inteiras" tanto na régua de decisão quanto no orçamento — você
 * compra dados em unidades de venda, não em frações.
 *
 * O investimento diário é arredondado a centavo ANTES de montar a escada porque é o
 * valor que o usuário realmente configura no anúncio (não dá pra anunciar R$10,4438/dia).
 *
 * @example
 *   calcularPlanoAds({ precoCentavos: 3990, margemContribuicaoCentavos: 1892, params: PARAMS_ADS_PADRAO })
 *   // → roasBreakeven 2.29, orçamento R$52,22, R$10,44/dia, escada 10,44→…→25,49
 */
export function calcularPlanoAds(entrada: PlanoAdsEntrada): PlanoAdsSaida {
  const { precoCentavos, margemContribuicaoCentavos: mc, params } = entrada;
  const fatorRetencao = 1 - params.taxaRetornoPct / 100;
  const mcLiquidaPct = precoCentavos === 0 ? 0 : (mc / precoCentavos) * fatorRetencao;

  if (mcLiquidaPct <= 0) return planoInviavel(mcLiquidaPct);

  const roasBreakeven = 1 / mcLiquidaPct;
  const cpaRaw = fatorRetencao * mc; // CPA máximo no break-even, em centavos sem arredondar
  const vendasEsperadas = Math.round(-Math.log(1 - params.nivelConfianca / 100));
  const orcamentoRaw = vendasEsperadas * cpaRaw;
  const investimentoDiarioCentavos = arredondarCentavos(orcamentoRaw / params.janelaTesteDias);
  const cliques = Math.floor(orcamentoRaw / params.cpcMedioCentavos);
  const escada = montarEscada(investimentoDiarioCentavos, params);

  return {
    inviavel: false,
    avisoInviavel: null,
    mcLiquidaPct,
    roasBreakeven,
    roasAlvoTeste: roasBreakeven, // em teste mira-se o break-even: comprar dados, não lucro
    roasAlvoEscala: roasBreakeven * params.fatorMargemEscala,
    cpaAlvoCentavos: arredondarCentavos(cpaRaw),
    vendasEsperadas,
    orcamentoTesteTotalCentavos: arredondarCentavos(orcamentoRaw),
    investimentoDiarioTesteCentavos: investimentoDiarioCentavos,
    cliquesEstimadosTeste: cliques,
    investimentoDiarioEscalaInicialCentavos:
      escada[0]?.budgetDiarioCentavos ?? investimentoDiarioCentavos,
    escada,
    avisos: coletarAvisos(cliques, investimentoDiarioCentavos, params),
  };
}

/**
 * Escada de orçamento diário: cada degrau sobe `passo%` e dura `cadência` dias.
 * Base = ritmo em que o teste validou. Para no `nDegraus` ou ao estourar o teto.
 */
function montarEscada(baseDiariaCentavos: number, params: ParamsAds): DegrauEscala[] {
  const { passoIncrementoPct, cadenciaIncrementoDias, nDegraus, tetoBudgetDiarioCentavos } = params;
  const escada: DegrauEscala[] = [];
  for (let i = 0; i < nDegraus; i++) {
    const budget = arredondarCentavos(baseDiariaCentavos * (1 + passoIncrementoPct / 100) ** i);
    if (tetoBudgetDiarioCentavos != null && budget > tetoBudgetDiarioCentavos) break;
    escada.push({
      degrau: i,
      diaInicio: i * cadenciaIncrementoDias + 1,
      diaFim: (i + 1) * cadenciaIncrementoDias,
      budgetDiarioCentavos: budget,
    });
  }
  return escada;
}

function coletarAvisos(
  cliques: number,
  investimentoDiarioCentavos: number,
  params: ParamsAds,
): string[] {
  const avisos: string[] = [];
  if (cliques < CLIQUES_MINIMO_CONFIAVEL) {
    avisos.push(
      'Amostra magra: menos de 60 cliques estimados. Suba o lance (CPC) ou o orçamento total.',
    );
  }
  const minimo = params.budgetDiarioMinimoCentavos;
  if (minimo != null && investimentoDiarioCentavos < minimo) {
    avisos.push(
      'Investimento diário do teste abaixo do mínimo da Shopee. Encurte a janela ou aumente o orçamento total.',
    );
  }
  return avisos;
}

function planoInviavel(mcLiquidaPct: number): PlanoAdsSaida {
  return {
    inviavel: true,
    avisoInviavel:
      'Margem líquida negativa ou zero: produto inviável para anúncio. Reveja preço, custo ou taxa antes de investir.',
    mcLiquidaPct,
    roasBreakeven: 0,
    roasAlvoTeste: 0,
    roasAlvoEscala: 0,
    cpaAlvoCentavos: 0,
    vendasEsperadas: 0,
    orcamentoTesteTotalCentavos: 0,
    investimentoDiarioTesteCentavos: 0,
    cliquesEstimadosTeste: 0,
    investimentoDiarioEscalaInicialCentavos: 0,
    escada: [],
    avisos: [],
  };
}
