import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { CalcularInputSchema } from '@mahou-hub/contracts';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

// Defaults de anúncio do Parametro singleton (espelham os defaults da migration).
function stubParametroAds(
  mock: ReturnType<typeof makePrismaMock>['mock'],
  overrides: Record<string, unknown> = {},
) {
  mock.parametro.findUnique.mockResolvedValue({
    id: 1,
    adsCpcMedioCentavos: 50,
    adsTaxaRetornoPct: new Prisma.Decimal(8),
    adsJanelaTesteDias: 5,
    adsNivelConfianca: 95,
    adsFatorMargemEscala: new Prisma.Decimal(1.4),
    adsPassoIncrementoPct: new Prisma.Decimal(25),
    adsCadenciaIncrementoDias: 3,
    adsNDegraus: 5,
    adsBudgetDiarioMinimoCentavos: null,
    adsTetoBudgetDiarioCentavos: null,
    ...overrides,
  } as never);
}

describe('PricingService.planoAds', () => {
  let mock: ReturnType<typeof makePrismaMock>['mock'];
  let svc: PricingService;

  beforeEach(() => {
    const m = makePrismaMock();
    mock = m.mock;
    svc = new PricingService(asPrisma(mock));
  });

  it('usa os defaults globais do Parametro e reproduz o caso de referência', async () => {
    stubParametroAds(mock);
    const r = await svc.planoAds({ precoCentavos: 3990, margemContribuicaoCentavos: 1892 });
    expect(r.inviavel).toBe(false);
    expect(Number(r.roasBreakeven.toFixed(2))).toBe(2.29);
    expect(Number(r.roasAlvoEscala.toFixed(2))).toBe(3.21);
    expect(r.orcamentoTesteTotalCentavos).toBe(5222);
    expect(r.investimentoDiarioTesteCentavos).toBe(1044);
    expect(r.escada.map((d) => d.budgetDiarioCentavos)).toEqual([1044, 1305, 1631, 2039, 2549]);
  });

  it('override no body sobrescreve o default global (confiança 99 → 5 vendas)', async () => {
    stubParametroAds(mock);
    const r = await svc.planoAds({
      precoCentavos: 3990,
      margemContribuicaoCentavos: 1892,
      params: { nivelConfianca: 99 },
    });
    expect(r.vendasEsperadas).toBe(5);
    expect(r.orcamentoTesteTotalCentavos).toBe(8703);
  });

  it('default global tunado (CPC menor no Parametro) aumenta os cliques estimados', async () => {
    stubParametroAds(mock, { adsCpcMedioCentavos: 25 });
    const r = await svc.planoAds({ precoCentavos: 3990, margemContribuicaoCentavos: 1892 });
    expect(r.cliquesEstimadosTeste).toBe(208); // 5221,92 / 0,25
  });

  it('margem de contribuição <= 0 → resposta inviável (não erro 500)', async () => {
    stubParametroAds(mock);
    const r = await svc.planoAds({ precoCentavos: 3990, margemContribuicaoCentavos: -100 });
    expect(r.inviavel).toBe(true);
    expect(r.avisoInviavel).toMatch(/inviável/i);
    expect(r.escada).toEqual([]);
  });
});

const FILAMENTO = {
  nome: 'PLA Branco',
  custoKgCentavos: 6683,
  potenciaA1W: 150,
  potenciaH2cW: 180,
};
const CALCULO = {
  filamentoCustoKgCentavos: FILAMENTO.custoKgCentavos,
  filamentoPotenciaA1W: FILAMENTO.potenciaA1W,
  filamentoPotenciaH2cW: FILAMENTO.potenciaH2cW,
  pesoG: 30,
  tempoH: 2,
  impressora: 'A1' as const,
  embalagemCentavos: 0,
  precoCentavos: 2490,
};
const CONFIGURACAO_ML = {
  categoriaId: 'MLB1234',
  tipoAnuncio: 'gold_special',
  modoEnvio: 'me2',
  tipoLogistica: 'drop_off',
  freteGratis: false,
  condicao: 'new',
  pesoGramas: 50,
  alturaCm: 5,
  larguraCm: 10,
  comprimentoCm: 15,
};
const SIMULACAO = {
  produtoId: 'ratinho',
  horasPorDia: 2,
  dias: 1,
  utilizacaoPct: 100,
  numeroImpressoras: 1,
};

function cotacaoMl() {
  return {
    contexto: { ...CONFIGURACAO_ML, precoCentavos: 2490 },
    categoriaNome: 'Categoria de teste',
    tarifaCentavos: 411,
    freteCentavos: 1385,
    tarifaFixaCentavos: 0,
    percentualTarifa: 16.5,
    cotadoEm: new Date().toISOString(),
    pendencias: [],
  };
}

describe('PricingService — custos Mercado Livre', () => {
  let mock: ReturnType<typeof makePrismaMock>['mock'];
  let svc: PricingService;

  beforeEach(() => {
    mock = makePrismaMock().mock;
    svc = new PricingService(asPrisma(mock));
    mock.parametro.findUnique.mockResolvedValue({
      tarifaKwhCentavos: 60,
      vendedorShopee: 'CNPJ',
      emCampanhaShopee: false,
      adicionalCampanhaPct: 0,
      comissaoMlPct: 99,
      impostoAtivo: true,
      impostoPct: 6,
      tiktokComissaoPlataformaPct: 6,
      tiktokTaxaSfpPct: 5,
      tiktokComissaoAfiliadoPct: 7,
      tiktokTaxaPagamentoPct: 2,
    } as never);
    mock.taxaShopee.findMany.mockResolvedValue([{
      limInferiorCentavos: 0,
      comissaoPct: 14,
      fixaCnpjCentavos: 300,
      fixaCpfBaixoCentavos: 400,
      fixaCpfAltoCentavos: 600,
    }] as never);
  });

  function produto(overrides: Record<string, unknown> = {}) {
    mock.produto.findUnique.mockResolvedValue({
      ...CALCULO,
      filamento: FILAMENTO,
      filamentos: [],
      insumos: [],
      canalPrincipal: 'ML',
      mercadoLivre: CONFIGURACAO_ML,
      ...overrides,
    } as never);
  }

  it('deixa o cálculo sem cotação pendente e não consulta a tabela ML antiga', async () => {
    const r = await svc.calcular(CALCULO);
    expect(r.custosMlStatus).toBe('PENDENTE');
    expect(r.liquidoMlCentavos).toBeNull();
    expect(r.liquidoShopeeCentavos).toBe(1474);
    expect(mock.taxaMercadoLivre.findMany).not.toHaveBeenCalled();
  });

  it('aceita custos explícitos na calculadora sem persistir no produto', async () => {
    const r = await svc.calcular({
      ...CALCULO,
      mercadoLivre: { tarifaCentavos: 411, freteCentavos: 1385 },
    });
    expect(r.liquidoMlCentavos).toBe(327);
    expect(r.custosMlStatus).toBe('COTADO');
    expect(mock.produto.update).not.toHaveBeenCalled();
  });

  it('exige custos completos e atuais para simular um produto do ML', async () => {
    produto();
    await expect(svc.simular(SIMULACAO)).rejects.toThrow(/cotação.*tarifa e frete/);
    produto({ cotacaoMl: { ...cotacaoMl(), freteCentavos: null } });
    await expect(svc.simular(SIMULACAO)).rejects.toThrow(/cotação.*tarifa e frete/);
  });

  it.each([
    { cotadoEm: '2020-01-01T00:00:00.000Z' },
    { contexto: { ...CONFIGURACAO_ML, precoCentavos: 2590 } },
  ])('rejeita cotação expirada ou para outro preço: %j', async (overrides) => {
    produto({ cotacaoMl: { ...cotacaoMl(), ...overrides } });
    await expect(svc.simular(SIMULACAO)).rejects.toThrow(/cotação/);
  });

  it('simula com a tarifa e o frete da cotação válida do produto', async () => {
    produto({ cotacaoMl: cotacaoMl() });
    const r = await svc.simular(SIMULACAO);
    expect(r.capacidadeUnidades).toBe(1);
    expect(r.lucroLiquidoCentavos).toBe(327);
    expect(r.margem).toBeCloseTo(327 / 2490);
  });

  it('simula outros canais sem exigir uma cotação ML', async () => {
    produto({ canalPrincipal: 'SHOPEE' });
    expect((await svc.simular(SIMULACAO)).lucroLiquidoCentavos).toBe(1474);
  });

  it('não inventa margem ML para modelo que só possui custo pronto', async () => {
    expect(await svc.economiaDeCustoPronto({
      canal: 'ML',
      precoCentavos: 2490,
      custoCentavos: 218,
      tempoHoras: 2,
    })).toMatchObject({
      impostoCentavos: 149,
      taxaMarketplaceCentavos: null,
      liquidoCentavos: null,
      margemPct: null,
      lucroPorHoraCentavos: null,
      custosMlStatus: 'PENDENTE',
    });
    expect(mock.taxaMercadoLivre.findMany).not.toHaveBeenCalled();
  });

  it('valida custos de simulação sem converter frete desconhecido em zero', () => {
    const parcial = { ...CALCULO, mercadoLivre: { tarifaCentavos: 411, freteCentavos: null } };
    expect(CalcularInputSchema.parse(parcial).mercadoLivre?.freteCentavos).toBeNull();
    expect(CalcularInputSchema.safeParse({
      ...CALCULO,
      mercadoLivre: { tarifaCentavos: -1, freteCentavos: 0 },
    }).success).toBe(false);
  });
});
