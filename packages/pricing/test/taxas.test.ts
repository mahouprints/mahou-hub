import { describe, expect, it } from 'vitest';
import { taxaMercadoLivreCentavos, taxaShopeeCentavos } from '../src/taxas';
import type { FaixaMercadoLivre, FaixaShopee, ParametrosGlobais } from '../src/types';

const TABELA_SHOPEE: FaixaShopee[] = [
  { limInferiorCentavos: 0, comissaoPct: 14, fixaCnpjCentavos: 0, fixaCpfBaixoCentavos: 0, fixaCpfAltoCentavos: 0 },
  { limInferiorCentavos: 800, comissaoPct: 14, fixaCnpjCentavos: 300, fixaCpfBaixoCentavos: 400, fixaCpfAltoCentavos: 600 },
  { limInferiorCentavos: 8000, comissaoPct: 14, fixaCnpjCentavos: 1600, fixaCpfBaixoCentavos: 2200, fixaCpfAltoCentavos: 2900 },
];

const TABELA_ML: FaixaMercadoLivre[] = [
  { faixa: 'A', limInferiorCentavos: 0, custoFixoCentavos: 0, pctAlternativo: 0.5, comissaoCategoriaPct: 15 },
  { faixa: 'B', limInferiorCentavos: 1250, custoFixoCentavos: 650, pctAlternativo: 0, comissaoCategoriaPct: 15 },
  { faixa: 'E', limInferiorCentavos: 7900, custoFixoCentavos: 1235, pctAlternativo: 0, comissaoCategoriaPct: 15 },
];

const PARAMETROS_BASE: ParametrosGlobais = {
  tarifaKwhCentavos: 60,
  vendedorShopee: 'CNPJ',
  emCampanhaShopee: false,
  adicionalCampanhaPct: 2.5,
  comissaoMlPct: 15,
  impostoAtivo: false,
  impostoPct: 0,
};

describe('taxaShopeeCentavos', () => {
  it('usa fixa CNPJ na faixa de R$8-80', () => {
    // preço R$35 → faixa 800: 14% de 3500 = 490 + fixa 300 CNPJ = 790
    expect(taxaShopeeCentavos(3500, PARAMETROS_BASE, TABELA_SHOPEE)).toBe(790);
  });

  it('em campanha soma adicionalCampanhaPct', () => {
    // 16,5% de 3500 = 577,5 + 300 = 877,5 ≈ 878
    const taxa = taxaShopeeCentavos(
      3500,
      { ...PARAMETROS_BASE, emCampanhaShopee: true },
      TABELA_SHOPEE,
    );
    expect(taxa).toBe(878);
  });

  it('troca de fixa por tipo de vendedor', () => {
    const cpfBaixo = taxaShopeeCentavos(
      3500,
      { ...PARAMETROS_BASE, vendedorShopee: 'CPF_BAIXO' },
      TABELA_SHOPEE,
    );
    expect(cpfBaixo).toBe(490 + 400);
  });

  it('preço acima de R$80 usa faixa 8000', () => {
    expect(taxaShopeeCentavos(9000, PARAMETROS_BASE, TABELA_SHOPEE)).toBe(
      Math.round(9000 * 0.14) + 1600,
    );
  });
});

describe('taxaMercadoLivreCentavos', () => {
  it('usa percentual alternativo quando maior que o custo fixo', () => {
    // R$10 → faixa A: comissão 15% (150) + max(0, 0.5% de 1000 = 5) = 155
    expect(taxaMercadoLivreCentavos(1000, PARAMETROS_BASE, TABELA_ML)).toBe(155);
  });

  it('usa custo fixo quando maior que alternativo', () => {
    // R$50 → faixa B: 15% de 5000 = 750 + max(650, 0) = 1400
    expect(taxaMercadoLivreCentavos(5000, PARAMETROS_BASE, TABELA_ML)).toBe(1400);
  });

  it('faixa E em produto premium', () => {
    // R$100 → faixa E: 15% de 10000 = 1500 + 1235 = 2735
    expect(taxaMercadoLivreCentavos(10000, PARAMETROS_BASE, TABELA_ML)).toBe(2735);
  });
});
