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
}

export interface CalculoEntrada {
  pesoG: number;
  tempoH: number;
  impressora: Impressora;
  filamento: Filamento;
  embalagemCentavos: number;
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
  liquidoShopeeCentavos: number;
  liquidoMlCentavos: number;
  liquidoSiteCentavos: number;
  margemShopee: number;
  margemMl: number;
  margemSite: number;
  lucroPorHoraShopeeCentavos: number;
  lucroPorHoraMlCentavos: number;
}
