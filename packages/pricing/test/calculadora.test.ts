import { describe, expect, it } from 'vitest';
import { calcularProduto } from '../src/calculadora';
import type {
  CalculoEntrada,
  FaixaMercadoLivre,
  FaixaShopee,
  Filamento,
  ParametrosGlobais,
} from '../src/types';

const FILAMENTO_PLA: Filamento = {
  nome: 'PLA Preto',
  custoKgCentavos: 7000,
  potenciaA1W: 130,
  potenciaH2cW: 160,
};

const PARAMETROS: ParametrosGlobais = {
  tarifaKwhCentavos: 60,
  vendedorShopee: 'CNPJ',
  emCampanhaShopee: false,
  adicionalCampanhaPct: 2.5,
  comissaoMlPct: 15,
  impostoAtivo: false,
  impostoPct: 0,
};

const TABELA_SHOPEE: FaixaShopee[] = [
  { limInferiorCentavos: 0, comissaoPct: 14, fixaCnpjCentavos: 300, fixaCpfBaixoCentavos: 400, fixaCpfAltoCentavos: 600 },
];

const TABELA_ML: FaixaMercadoLivre[] = [
  { faixa: 'B', limInferiorCentavos: 0, custoFixoCentavos: 650, pctAlternativo: 0, comissaoCategoriaPct: 15 },
];

const ENTRADA_BASE: CalculoEntrada = {
  pesoG: 50,
  tempoH: 2,
  impressora: 'A1',
  filamento: FILAMENTO_PLA,
  embalagemCentavos: 150,
  precoCentavos: 3500,
  parametros: PARAMETROS,
  tabelaShopee: TABELA_SHOPEE,
  tabelaMercadoLivre: TABELA_ML,
};

describe('calcularProduto', () => {
  it('compõe custos de produção corretamente', () => {
    const r = calcularProduto(ENTRADA_BASE);
    expect(r.custoFilamentoCentavos).toBe(350); // 50g × R$70/kg
    expect(r.custoEnergiaCentavos).toBe(16); // 2h × 130W × 0.60 / 1000
    expect(r.custoTotalProducaoCentavos).toBe(350 + 16 + 150);
  });

  it('produz líquidos diferentes por canal — site não paga taxa de marketplace', () => {
    const r = calcularProduto(ENTRADA_BASE);
    expect(r.liquidoSiteCentavos).toBeGreaterThan(r.liquidoShopeeCentavos);
    expect(r.liquidoSiteCentavos).toBeGreaterThan(r.liquidoMlCentavos);
    expect(r.liquidoShopeeCentavos).not.toBe(r.liquidoMlCentavos);
  });

  it('imposto reduz líquido quando ativo', () => {
    const semImposto = calcularProduto(ENTRADA_BASE);
    const comImposto = calcularProduto({
      ...ENTRADA_BASE,
      parametros: { ...PARAMETROS, impostoAtivo: true, impostoPct: 6 },
    });
    expect(comImposto.liquidoSiteCentavos).toBeLessThan(semImposto.liquidoSiteCentavos);
    expect(comImposto.impostoCentavos).toBe(210); // 6% de 3500
  });

  it('calcula lucro/hora dividindo líquido por tempo', () => {
    const r = calcularProduto(ENTRADA_BASE);
    expect(r.lucroPorHoraMlCentavos).toBe(Math.round(r.liquidoMlCentavos / 2));
  });

  it('margem zero quando preço cobre exatamente custos+taxas', () => {
    const r = calcularProduto({ ...ENTRADA_BASE, precoCentavos: 1000 });
    expect(typeof r.margemMl).toBe('number');
  });
});
