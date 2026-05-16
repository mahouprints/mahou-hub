import { describe, expect, it } from 'vitest';
import { capacidade, simularCenario } from '../src/simulador.js';

describe('capacidade', () => {
  it('arredonda para baixo', () => {
    expect(capacidade(10, 3)).toBe(3);
  });

  it('rejeita tempo unitário zero', () => {
    expect(() => capacidade(10, 0)).toThrow(/> 0/);
  });
});

describe('simularCenario', () => {
  it('paridade com cenário-exemplo da planilha (Kit c/3 Suportes ~31% margem)', () => {
    const r = simularCenario({
      horasPorDia: 24,
      dias: 31,
      utilizacaoPct: 80,
      numeroImpressoras: 1,
      tempoUnitarioH: 0.75,
      precoCentavos: 1990,
      liquidoUnitarioCentavos: 610,
    });
    expect(r.horasTotais).toBeCloseTo(595.2);
    expect(r.capacidadeUnidades).toBe(793);
    expect(r.faturamentoCentavos).toBe(793 * 1990);
    expect(r.lucroLiquidoCentavos).toBe(793 * 610);
    expect(r.margem).toBeCloseTo(610 / 1990, 4);
  });
});
