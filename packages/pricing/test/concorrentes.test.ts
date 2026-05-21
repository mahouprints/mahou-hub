import { describe, expect, it } from 'vitest';
import {
  TAXA_AFILIADO_SHOPEE,
  estimarVendasTotaisMes,
  somarVendasEstimadasMes,
} from '../src/concorrentes';

const ABR_20 = '2026-04-20T00:00:00Z';
const MAI_20 = '2026-05-20T00:00:00Z'; // janela de 30 dias

describe('estimarVendasTotaisMes', () => {
  it('janela de 30 dias com sales=449 → ~8980 (449 / 0.05)', () => {
    const r = estimarVendasTotaisMes({ sales: 449, periodStartTime: ABR_20, periodEndTime: MAI_20 });
    expect(r).toBe(Math.round(449 / TAXA_AFILIADO_SHOPEE));
  });

  it('janela de 15 dias com sales=100 → projeta pra 30 dias antes de aplicar a taxa', () => {
    const r = estimarVendasTotaisMes({
      sales: 100,
      periodStartTime: '2026-04-20T00:00:00Z',
      periodEndTime: '2026-05-05T00:00:00Z',
    });
    // 100 / 15 * 30 = 200; 200 / 0.05 = 4000
    expect(r).toBe(4000);
  });

  it('aceita Date instances no lugar de strings ISO', () => {
    const r = estimarVendasTotaisMes({
      sales: 449,
      periodStartTime: new Date(ABR_20),
      periodEndTime: new Date(MAI_20),
    });
    expect(r).toBe(Math.round(449 / TAXA_AFILIADO_SHOPEE));
  });

  it('janela inválida (mesmo instante) → usa sales bruto sem normalizar', () => {
    const r = estimarVendasTotaisMes({
      sales: 50,
      periodStartTime: ABR_20,
      periodEndTime: ABR_20,
    });
    // diasJanela=0 → fallback pro sales bruto → 50 / 0.05 = 1000
    expect(r).toBe(1000);
  });

  it('sales=0 → 0', () => {
    expect(
      estimarVendasTotaisMes({ sales: 0, periodStartTime: ABR_20, periodEndTime: MAI_20 }),
    ).toBe(0);
  });
});

describe('somarVendasEstimadasMes', () => {
  it('soma a estimativa de cada produto', () => {
    const total = somarVendasEstimadasMes([
      { sales: 449, periodStartTime: ABR_20, periodEndTime: MAI_20 },
      { sales: 100, periodStartTime: ABR_20, periodEndTime: MAI_20 },
    ]);
    // (449 + 100) / 0.05 = 10980
    expect(total).toBe(Math.round(449 / 0.05) + Math.round(100 / 0.05));
  });

  it('lista vazia → 0', () => {
    expect(somarVendasEstimadasMes([])).toBe(0);
  });
});
