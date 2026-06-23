import { describe, expect, it } from 'vitest';
import {
  PARAMS_ADS_PADRAO,
  calcularPlanoAds,
  margemContribuicaoBrutaCentavos,
} from '../src/planoAds';
import type { ParamsAds } from '../src/types';

/**
 * Caso de referência do prompt (taxa Shopee chapada em 20%, sem imposto):
 *   preco=39,90  cmv=13,00  taxa=20%  retorno=8%  cpc=0,50  janela=5d
 *   confianca=95%  fator_escala=1,40  passo=25%  cadencia=3d  N=5
 * É a fonte de verdade — os números abaixo vêm da tabela do prompt.
 * Aqui a margem de contribuição vem do caminho chapado (override manual);
 * no app real ela vem do líquido Shopee de `calcularProduto`.
 */
const PRECO_REF = 3990;
const MC_BRUTA_REF = margemContribuicaoBrutaCentavos(PRECO_REF, 1300, 20); // 1892

describe('margemContribuicaoBrutaCentavos (caminho chapado / override)', () => {
  it('preço − cmv − taxa%: reproduz mc_bruta = 18,92', () => {
    expect(MC_BRUTA_REF).toBe(1892);
  });
});

describe('calcularPlanoAds — caso de referência do prompt', () => {
  const r = calcularPlanoAds({
    precoCentavos: PRECO_REF,
    margemContribuicaoCentavos: MC_BRUTA_REF,
    params: PARAMS_ADS_PADRAO,
  });

  it('os defaults de anúncio batem com o prompt', () => {
    expect(PARAMS_ADS_PADRAO.cpcMedioCentavos).toBe(50);
    expect(PARAMS_ADS_PADRAO.taxaRetornoPct).toBe(8);
    expect(PARAMS_ADS_PADRAO.janelaTesteDias).toBe(5);
    expect(PARAMS_ADS_PADRAO.nivelConfianca).toBe(95);
    expect(PARAMS_ADS_PADRAO.fatorMargemEscala).toBe(1.4);
    expect(PARAMS_ADS_PADRAO.passoIncrementoPct).toBe(25);
    expect(PARAMS_ADS_PADRAO.cadenciaIncrementoDias).toBe(3);
    expect(PARAMS_ADS_PADRAO.nDegraus).toBe(5);
  });

  it('produto viável (margem líquida positiva)', () => {
    expect(r.inviavel).toBe(false);
    expect(r.avisoInviavel).toBeNull();
  });

  it('margem líquida de devoluções = 43,63%', () => {
    expect(Number(r.mcLiquidaPct.toFixed(4))).toBe(0.4363);
  });

  it('ROAS break-even e alvos', () => {
    expect(Number(r.roasBreakeven.toFixed(2))).toBe(2.29);
    expect(Number(r.roasAlvoTeste.toFixed(2))).toBe(2.29);
    expect(Number(r.roasAlvoEscala.toFixed(2))).toBe(3.21);
  });

  it('CPA alvo no break-even = R$17,41', () => {
    expect(r.cpaAlvoCentavos).toBe(1741);
  });

  it('cenário Teste: vendas, orçamento, investimento diário, cliques', () => {
    expect(r.vendasEsperadas).toBe(3);
    expect(r.orcamentoTesteTotalCentavos).toBe(5222);
    expect(r.investimentoDiarioTesteCentavos).toBe(1044);
    expect(r.cliquesEstimadosTeste).toBe(104);
  });

  it('escada de escalonamento: 5 degraus em R$/dia', () => {
    expect(r.investimentoDiarioEscalaInicialCentavos).toBe(1044);
    expect(r.escada.map((d) => d.budgetDiarioCentavos)).toEqual([1044, 1305, 1631, 2039, 2549]);
  });

  it('escada de escalonamento: janelas de dias por degrau', () => {
    expect(r.escada.map((d) => [d.diaInicio, d.diaFim])).toEqual([
      [1, 3],
      [4, 6],
      [7, 9],
      [10, 12],
      [13, 15],
    ]);
  });

  it('sem avisos no caso de referência (cliques ≥ 60, sem mínimo Shopee)', () => {
    expect(r.avisos).toEqual([]);
  });
});

describe('calcularPlanoAds — casos de borda', () => {
  it('margem negativa: produto inviável, não calcula ROAS', () => {
    const r = calcularPlanoAds({
      precoCentavos: 3990,
      margemContribuicaoCentavos: -200, // custo+taxa engoliram a margem
      params: PARAMS_ADS_PADRAO,
    });
    expect(r.inviavel).toBe(true);
    expect(r.avisoInviavel).toMatch(/margem/i);
    expect(r.roasBreakeven).toBe(0);
    expect(r.escada).toEqual([]);
  });

  it('retorno 0%: fator de retenção = 1, CPA = margem de contribuição cheia', () => {
    const r = calcularPlanoAds({
      precoCentavos: 3990,
      margemContribuicaoCentavos: 1892,
      params: { ...PARAMS_ADS_PADRAO, taxaRetornoPct: 0 },
    });
    expect(r.cpaAlvoCentavos).toBe(1892);
  });

  it('confiança 99%: k ≈ 4,6 → 5 vendas esperadas, orçamento maior', () => {
    const r = calcularPlanoAds({
      precoCentavos: 3990,
      margemContribuicaoCentavos: 1892,
      params: { ...PARAMS_ADS_PADRAO, nivelConfianca: 99 },
    });
    expect(r.vendasEsperadas).toBe(5);
    expect(r.orcamentoTesteTotalCentavos).toBe(8703); // 5 × 1740,64
  });

  it('janela de 1 dia: investimento diário = orçamento total', () => {
    const r = calcularPlanoAds({
      precoCentavos: 3990,
      margemContribuicaoCentavos: 1892,
      params: { ...PARAMS_ADS_PADRAO, janelaTesteDias: 1 },
    });
    expect(r.investimentoDiarioTesteCentavos).toBe(r.orcamentoTesteTotalCentavos);
    expect(r.investimentoDiarioTesteCentavos).toBe(5222);
  });

  it('CPC alto: amostra magra (< 60 cliques) gera aviso', () => {
    const r = calcularPlanoAds({
      precoCentavos: 3990,
      margemContribuicaoCentavos: 1892,
      params: { ...PARAMS_ADS_PADRAO, cpcMedioCentavos: 10000 }, // R$100/clique
    });
    expect(r.cliquesEstimadosTeste).toBeLessThan(60);
    expect(r.avisos.some((a) => /amostra magra/i.test(a))).toBe(true);
  });

  it('budget diário abaixo do mínimo Shopee gera aviso', () => {
    const r = calcularPlanoAds({
      precoCentavos: 3990,
      margemContribuicaoCentavos: 1892,
      params: { ...PARAMS_ADS_PADRAO, budgetDiarioMinimoCentavos: 2000 }, // R$20 > 10,44
    });
    expect(r.avisos.some((a) => /m[ií]nimo|encurtar/i.test(a))).toBe(true);
  });

  it('teto de budget diário corta a escada antes de estourar', () => {
    const r = calcularPlanoAds({
      precoCentavos: 3990,
      margemContribuicaoCentavos: 1892,
      params: { ...PARAMS_ADS_PADRAO, tetoBudgetDiarioCentavos: 1500 }, // R$15
    });
    // base 1044 e 1305 cabem; 1631 estoura o teto → escada de 2 degraus
    expect(r.escada).toHaveLength(2);
    expect(r.escada.every((d) => d.budgetDiarioCentavos <= 1500)).toBe(true);
  });
});
