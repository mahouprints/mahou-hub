import { describe, expect, it } from 'vitest';
import { custoEnergiaCentavos, custoFilamentoCentavos } from '../src/custos.js';
import type { Filamento } from '../src/types.js';

const FILAMENTO_ABS: Filamento = {
  nome: 'ABS Branco',
  custoKgCentavos: 6300,
  potenciaA1W: 180,
  potenciaH2cW: 280,
};

describe('custoFilamentoCentavos', () => {
  it('calcula 50g a R$63/kg = R$3,15', () => {
    expect(custoFilamentoCentavos(50, 6300)).toBe(315);
  });

  it('arredonda meio-centavo para o inteiro mais próximo', () => {
    expect(custoFilamentoCentavos(7, 7000)).toBe(49);
  });

  it('retorna 0 para peso 0', () => {
    expect(custoFilamentoCentavos(0, 6300)).toBe(0);
  });

  it('rejeita peso negativo', () => {
    expect(() => custoFilamentoCentavos(-10, 6300)).toThrow(/>= 0/);
  });
});

describe('custoEnergiaCentavos', () => {
  it('A1 com 2h × 180W × R$0,60/kWh ≈ R$0,22', () => {
    expect(custoEnergiaCentavos(2, FILAMENTO_ABS, 'A1', 60)).toBe(22);
  });

  it('H2C usa potência diferente', () => {
    expect(custoEnergiaCentavos(2, FILAMENTO_ABS, 'H2C', 60)).toBe(34);
  });

  it('zero horas → custo zero', () => {
    expect(custoEnergiaCentavos(0, FILAMENTO_ABS, 'A1', 60)).toBe(0);
  });
});
