import { describe, expect, it } from 'vitest';
import { dataLocalDeDiaCivil, dataUtcDoDiaLocal, formatarDataCivil } from '../lib/data-civil';

describe('dia civil das vendas e custos', () => {
  it('venda criada no domingo à noite permanece na semana do dia selecionado', () => {
    expect(dataUtcDoDiaLocal(new Date(2026, 8, 20, 23, 45)).toISOString()).toBe(
      '2026-09-20T00:00:00.000Z',
    );
  });
  it('mantém o mês/ano local ao criar no último dia à noite', () => {
    expect(dataUtcDoDiaLocal(new Date(2026, 11, 31, 23, 59)).toISOString()).toBe(
      '2026-12-31T00:00:00.000Z',
    );
  });
  it.each(['2026-09-01', '2028-02-29', '2026-12-31'])(
    'editar %s não desloca o dia nem o mês',
    (dia) => {
      const calendario = dataLocalDeDiaCivil(`${dia}T00:00:00.000Z`);
      expect(dataUtcDoDiaLocal(calendario).toISOString()).toBe(`${dia}T00:00:00.000Z`);
    },
  );
  it('preserva o prefixo civil de dados existentes com horário', () => {
    expect(dataUtcDoDiaLocal(dataLocalDeDiaCivil('2026-09-20T23:30:00.000Z')).toISOString()).toBe(
      '2026-09-20T00:00:00.000Z',
    );
  });
  it('exibe a mesma data para payload JSON e objeto Date do contrato', () => {
    expect(formatarDataCivil('2026-09-20T00:00:00.000Z')).toBe('20/09/2026');
    expect(formatarDataCivil(new Date('2026-09-20T00:00:00.000Z'))).toBe('20/09/2026');
  });
});
