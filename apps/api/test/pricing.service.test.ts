import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
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
