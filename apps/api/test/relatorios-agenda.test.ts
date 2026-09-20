import { describe, expect, it } from 'vitest';
import { relatoriosVencidos } from '../src/modules/relatorios/relatorios-agenda';

const instante = (iso: string) => new Date(iso);

describe('agenda de relatórios às 08h na Bahia', () => {
  it('espera até segunda às 08h local e fecha a semana anterior', () => {
    const desde = instante('2026-09-20T12:00:00.000Z');
    expect(relatoriosVencidos(instante('2026-09-21T10:59:59.999Z'), desde)).toEqual([]);
    expect(relatoriosVencidos(instante('2026-09-21T11:00:00.000Z'), desde)).toEqual([
      { periodo: 'SEMANAL', referencia: '2026-09-20' },
    ]);
  });

  it('fecha dezembro e o ano anterior no dia 1º de janeiro', () => {
    expect(
      relatoriosVencidos(
        instante('2027-01-01T11:00:00.000Z'),
        instante('2026-12-31T14:00:00.000Z'),
      ),
    ).toEqual([
      { periodo: 'MENSAL', referencia: '2026-12-31' },
      { periodo: 'ANUAL', referencia: '2026-12-31' },
    ]);
  });

  it('gera os três períodos quando 1º de janeiro cai numa segunda', () => {
    expect(
      relatoriosVencidos(
        instante('2029-01-01T11:00:00.000Z'),
        instante('2028-12-31T18:00:00.000Z'),
      ),
    ).toEqual([
      { periodo: 'SEMANAL', referencia: '2028-12-31' },
      { periodo: 'MENSAL', referencia: '2028-12-31' },
      { periodo: 'ANUAL', referencia: '2028-12-31' },
    ]);
  });

  it('não envia fechamento anterior à ativação e aguarda o próximo', () => {
    const ativado = instante('2026-09-21T11:00:00.001Z');
    expect(relatoriosVencidos(instante('2026-09-22T11:00:00.000Z'), ativado)).toEqual([]);
    expect(relatoriosVencidos(instante('2026-09-28T11:00:00.000Z'), ativado)).toEqual([
      { periodo: 'SEMANAL', referencia: '2026-09-27' },
    ]);
  });

  it('exclui fechamento exatamente no cursor para não enviar duas vezes', () => {
    const fechamento = instante('2029-01-01T11:00:00.000Z');
    expect(relatoriosVencidos(fechamento, fechamento)).toEqual([]);
    expect(relatoriosVencidos(instante('2029-01-01T11:15:00.000Z'), fechamento)).toEqual([]);
  });

  it('recupera fechamentos perdidos sem omitir a virada de mês', () => {
    expect(
      relatoriosVencidos(
        instante('2026-09-08T15:00:00.000Z'),
        instante('2026-08-30T12:00:00.000Z'),
      ),
    ).toEqual([
      { periodo: 'SEMANAL', referencia: '2026-08-30' },
      { periodo: 'MENSAL', referencia: '2026-08-31' },
      { periodo: 'SEMANAL', referencia: '2026-09-06' },
    ]);
  });

  it('recupera fechamento em consulta tardia, e o novo cursor impede repetição', () => {
    const antes = instante('2026-09-21T10:59:59.999Z');
    const consultaTardia = instante('2026-09-23T16:40:00.000Z');
    expect(relatoriosVencidos(consultaTardia, antes)).toEqual([
      { periodo: 'SEMANAL', referencia: '2026-09-20' },
    ]);
    expect(relatoriosVencidos(instante('2026-09-24T16:40:00.000Z'), consultaTardia)).toEqual([]);
  });

  it('considera o dia civil da Bahia quando o cursor está antes das 03h UTC', () => {
    expect(
      relatoriosVencidos(
        instante('2026-09-21T11:00:00.000Z'),
        instante('2026-09-21T02:00:00.000Z'),
      ),
    ).toEqual([{ periodo: 'SEMANAL', referencia: '2026-09-20' }]);
  });

  it('fecha fevereiro bissexto no último dia existente', () => {
    expect(
      relatoriosVencidos(
        instante('2028-03-01T11:00:00.000Z'),
        instante('2028-02-29T12:00:00.000Z'),
      ),
    ).toEqual([{ periodo: 'MENSAL', referencia: '2028-02-29' }]);
  });

  it('não gera envio em dia comum nem quando o cursor está no futuro', () => {
    expect(
      relatoriosVencidos(
        instante('2026-09-23T11:00:00.000Z'),
        instante('2026-09-22T12:00:00.000Z'),
      ),
    ).toEqual([]);
    expect(
      relatoriosVencidos(
        instante('2026-09-21T11:00:00.000Z'),
        instante('2026-09-22T12:00:00.000Z'),
      ),
    ).toEqual([]);
  });
});
