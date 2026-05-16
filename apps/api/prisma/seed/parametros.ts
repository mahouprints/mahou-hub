export const PARAMETROS = {
  tarifaKwhCentavos: 85,
  vendedorShopee: 'CNPJ' as const,
  emCampanhaShopee: false,
  adicionalCampanhaPct: 2.5,
  comissaoMlPct: 15,
  impostoAtivo: true,
  impostoPct: 0,
};

export const TAXAS_SHOPEE = [
  {
    limInferiorCentavos: 0,
    comissaoPct: 50,
    fixaCnpjCentavos: 0,
    fixaCpfBaixoCentavos: 0,
    fixaCpfAltoCentavos: 300,
  },
  {
    limInferiorCentavos: 800,
    comissaoPct: 20,
    fixaCnpjCentavos: 400,
    fixaCpfBaixoCentavos: 400,
    fixaCpfAltoCentavos: 700,
  },
  {
    limInferiorCentavos: 8000,
    comissaoPct: 14,
    fixaCnpjCentavos: 1600,
    fixaCpfBaixoCentavos: 1600,
    fixaCpfAltoCentavos: 1900,
  },
  {
    limInferiorCentavos: 10000,
    comissaoPct: 14,
    fixaCnpjCentavos: 2000,
    fixaCpfBaixoCentavos: 2000,
    fixaCpfAltoCentavos: 2300,
  },
  {
    limInferiorCentavos: 20000,
    comissaoPct: 14,
    fixaCnpjCentavos: 2600,
    fixaCpfBaixoCentavos: 2600,
    fixaCpfAltoCentavos: 2900,
  },
];

export const TAXAS_ML = [
  { faixa: 'A', limInferiorCentavos: 0, custoFixoCentavos: 50, pctAlternativo: 15, comissaoCategoriaPct: 0 },
  { faixa: 'B', limInferiorCentavos: 600, custoFixoCentavos: 0, pctAlternativo: 15, comissaoCategoriaPct: 0 },
  { faixa: 'C', limInferiorCentavos: 795, custoFixoCentavos: 0, pctAlternativo: 15, comissaoCategoriaPct: 0 },
  { faixa: 'D', limInferiorCentavos: 795, custoFixoCentavos: 0, pctAlternativo: 15, comissaoCategoriaPct: 0 },
  { faixa: 'E', limInferiorCentavos: 1235, custoFixoCentavos: 0, pctAlternativo: 15, comissaoCategoriaPct: 0 },
];
