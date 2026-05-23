import { describe, expect, it } from 'vitest';
import {
  normalizarVendasAfiliadoMes,
  somarVendasAfiliadoMes,
  // Aliases @deprecated — verificar que continuam apontando pras novas
  estimarVendasTotaisMes,
  somarVendasEstimadasMes,
} from '../src/concorrentes';

const ABR_20 = '2026-04-20T00:00:00Z';
const MAI_20 = '2026-05-20T00:00:00Z'; // janela de 30 dias

describe('normalizarVendasAfiliadoMes', () => {
  it('janela de 30 dias com sales=449 → 449 (sales direto, sem ajuste)', () => {
    const r = normalizarVendasAfiliadoMes({
      sales: 449,
      periodStartTime: ABR_20,
      periodEndTime: MAI_20,
    });
    expect(r).toBe(449);
  });

  it('janela de 15 dias com sales=100 → 200 (projeção 30/15)', () => {
    const r = normalizarVendasAfiliadoMes({
      sales: 100,
      periodStartTime: '2026-04-20T00:00:00Z',
      periodEndTime: '2026-05-05T00:00:00Z',
    });
    expect(r).toBe(200);
  });

  it('janela de 60 dias com sales=600 → 300 (projeção 30/60)', () => {
    const r = normalizarVendasAfiliadoMes({
      sales: 600,
      periodStartTime: '2026-04-20T00:00:00Z',
      periodEndTime: '2026-06-19T00:00:00Z',
    });
    expect(r).toBe(300);
  });

  it('aceita Date instances no lugar de strings ISO', () => {
    const r = normalizarVendasAfiliadoMes({
      sales: 449,
      periodStartTime: new Date(ABR_20),
      periodEndTime: new Date(MAI_20),
    });
    expect(r).toBe(449);
  });

  it('janela inválida (mesmo instante) → usa sales bruto sem normalizar', () => {
    const r = normalizarVendasAfiliadoMes({
      sales: 50,
      periodStartTime: ABR_20,
      periodEndTime: ABR_20,
    });
    expect(r).toBe(50);
  });

  it('sales=0 → 0', () => {
    expect(
      normalizarVendasAfiliadoMes({ sales: 0, periodStartTime: ABR_20, periodEndTime: MAI_20 }),
    ).toBe(0);
  });
});

describe('somarVendasAfiliadoMes', () => {
  it('soma `sales` normalizado de cada produto', () => {
    const total = somarVendasAfiliadoMes([
      { sales: 449, periodStartTime: ABR_20, periodEndTime: MAI_20 },
      { sales: 100, periodStartTime: ABR_20, periodEndTime: MAI_20 },
    ]);
    expect(total).toBe(449 + 100);
  });

  it('lista vazia → 0', () => {
    expect(somarVendasAfiliadoMes([])).toBe(0);
  });
});

describe('aliases @deprecated', () => {
  it('estimarVendasTotaisMes ainda funciona (aponta pra nova função)', () => {
    expect(
      estimarVendasTotaisMes({ sales: 449, periodStartTime: ABR_20, periodEndTime: MAI_20 }),
    ).toBe(449);
  });

  it('somarVendasEstimadasMes ainda funciona', () => {
    expect(
      somarVendasEstimadasMes([{ sales: 100, periodStartTime: ABR_20, periodEndTime: MAI_20 }]),
    ).toBe(100);
  });
});
