export type Impressora = 'A1' | 'H2C';
export type Canal = 'SHOPEE' | 'ML' | 'SITE';
export type VendedorShopee = 'CNPJ' | 'CPF_BAIXO' | 'CPF_ALTO';

export interface Filamento {
  nome: string;
  custoKgCentavos: number;
  potenciaA1W: number;
  potenciaH2cW: number;
}

/**
 * Faixa de comissão da Shopee.
 * Cada linha vale para preços >= limInferiorCentavos até o limite da próxima faixa.
 * Réplica das colunas A-F da aba Parâmetros (linhas 4-8).
 */
export interface FaixaShopee {
  limInferiorCentavos: number;
  comissaoPct: number;
  fixaCnpjCentavos: number;
  fixaCpfBaixoCentavos: number;
  fixaCpfAltoCentavos: number;
}

/**
 * Faixa de tarifa do Mercado Livre.
 * Réplica das colunas A-E da aba Parâmetros (linhas 12-16).
 */
export interface FaixaMercadoLivre {
  faixa: 'A' | 'B' | 'C' | 'D' | 'E';
  limInferiorCentavos: number;
  custoFixoCentavos: number;
  pctAlternativo: number;
  comissaoCategoriaPct: number;
}

export interface ParametrosGlobais {
  tarifaKwhCentavos: number;
  vendedorShopee: VendedorShopee;
  emCampanhaShopee: boolean;
  adicionalCampanhaPct: number;
  comissaoMlPct: number;
  impostoAtivo: boolean;
  impostoPct: number;
  /** Taxas do TikTok Shop — todas percentuais simples, somam pra dar taxa total. */
  tiktokComissaoPlataformaPct: number;
  tiktokTaxaSfpPct: number;
  tiktokComissaoAfiliadoPct: number;
  tiktokTaxaPagamentoPct: number;
}

export interface CalculoEntrada {
  pesoG: number;
  tempoH: number;
  impressora: Impressora;
  filamento: Filamento;
  embalagemCentavos: number;
  /** Soma `qtd × custoUnitário` dos Insumos do produto. Opcional — default 0. */
  custoInsumosCentavos?: number;
  precoCentavos: number;
  parametros: ParametrosGlobais;
  tabelaShopee: FaixaShopee[];
  tabelaMercadoLivre: FaixaMercadoLivre[];
}

export interface CalculoSaida {
  custoFilamentoCentavos: number;
  custoEnergiaCentavos: number;
  custoTotalProducaoCentavos: number;
  impostoCentavos: number;
  taxaShopeeCentavos: number;
  taxaMlCentavos: number;
  taxaTikTokCentavos: number;
  liquidoShopeeCentavos: number;
  liquidoMlCentavos: number;
  liquidoSiteCentavos: number;
  liquidoTikTokCentavos: number;
  margemShopee: number;
  margemMl: number;
  margemSite: number;
  margemTikTok: number;
  lucroPorHoraShopeeCentavos: number;
  lucroPorHoraMlCentavos: number;
  lucroPorHoraSiteCentavos: number;
  lucroPorHoraTikTokCentavos: number;
}

export type NivelConfianca = 95 | 99;

/**
 * Parâmetros do plano de anúncios (Shopee Ads). Os defaults globais vivem no
 * Parametro singleton; a Calculadora permite override local sem persistir.
 */
export interface ParamsAds {
  cpcMedioCentavos: number;
  taxaRetornoPct: number;
  janelaTesteDias: number;
  nivelConfianca: NivelConfianca;
  fatorMargemEscala: number;
  passoIncrementoPct: number;
  cadenciaIncrementoDias: number;
  nDegraus: number;
  /** Orçamento diário mínimo da plataforma (Shopee). Abaixo dele, gera aviso. */
  budgetDiarioMinimoCentavos?: number | null;
  /** Teto de orçamento diário: a escada para antes de ultrapassar. */
  tetoBudgetDiarioCentavos?: number | null;
}

export interface PlanoAdsEntrada {
  precoCentavos: number;
  /**
   * Margem de contribuição por venda bruta (centavos), ANTES do desconto de devoluções.
   * No app real = líquido do canal (já líquido de taxa marketplace + imposto).
   * No caminho hipotético/override = preço − cmv − taxa (margemContribuicaoBrutaCentavos).
   */
  margemContribuicaoCentavos: number;
  params: ParamsAds;
}

/** Um degrau da escada de escalonamento de orçamento diário. */
export interface DegrauEscala {
  /** 0-indexed. */
  degrau: number;
  diaInicio: number;
  diaFim: number;
  budgetDiarioCentavos: number;
}

export interface PlanoAdsSaida {
  inviavel: boolean;
  avisoInviavel: string | null;
  /** Margem líquida de devoluções como fração (0.4363 = 43,63%). */
  mcLiquidaPct: number;
  roasBreakeven: number;
  roasAlvoTeste: number;
  roasAlvoEscala: number;
  cpaAlvoCentavos: number;
  vendasEsperadas: number;
  orcamentoTesteTotalCentavos: number;
  investimentoDiarioTesteCentavos: number;
  cliquesEstimadosTeste: number;
  investimentoDiarioEscalaInicialCentavos: number;
  escada: DegrauEscala[];
  avisos: string[];
}
