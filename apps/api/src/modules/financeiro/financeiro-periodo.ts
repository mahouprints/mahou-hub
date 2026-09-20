import { BadRequestException } from '@nestjs/common';
import {
  RelatorioFinanceiroQuerySchema,
  type RelatorioFinanceiroQuery,
} from '@mahou-hub/contracts';

/** Intervalo civil inclusivo para apresentação e exclusivo para consultas Prisma. */
export function definirPeriodoFinanceiro(entrada: RelatorioFinanceiroQuery) {
  const validado = RelatorioFinanceiroQuerySchema.safeParse(entrada);
  if (!validado.success)
    throw new BadRequestException(
      'Esperado período DIARIO, SEMANAL, MENSAL ou ANUAL e referência YYYY-MM-DD existente',
    );
  const { periodo, referencia } = validado.data;
  const gte = new Date(`${referencia}T00:00:00.000Z`);
  if (periodo === 'SEMANAL') gte.setUTCDate(gte.getUTCDate() - ((gte.getUTCDay() + 6) % 7));
  if (periodo === 'MENSAL') gte.setUTCDate(1);
  if (periodo === 'ANUAL') gte.setUTCMonth(0, 1);
  const lt = avancarPeriodo(gte, periodo);
  const fim = diaCivil(new Date(lt.getTime() - 86400000));
  return {
    periodo,
    referencia,
    inicio: diaCivil(gte),
    fim,
    titulo: tituloPeriodo(periodo, gte, fim),
    gte,
    lt,
  };
}

function avancarPeriodo(inicio: Date, periodo: RelatorioFinanceiroQuery['periodo']) {
  const fim = new Date(inicio);
  if (periodo === 'DIARIO') fim.setUTCDate(fim.getUTCDate() + 1);
  if (periodo === 'SEMANAL') fim.setUTCDate(fim.getUTCDate() + 7);
  if (periodo === 'MENSAL') fim.setUTCMonth(fim.getUTCMonth() + 1);
  if (periodo === 'ANUAL') fim.setUTCFullYear(fim.getUTCFullYear() + 1);
  return fim;
}

function tituloPeriodo(periodo: RelatorioFinanceiroQuery['periodo'], inicio: Date, fim: string) {
  if (periodo === 'DIARIO') return `Dia ${diaBr(diaCivil(inicio))}`;
  if (periodo === 'ANUAL') return `Ano de ${inicio.getUTCFullYear()}`;
  if (periodo === 'SEMANAL') return `Semana de ${diaBr(diaCivil(inicio))} a ${diaBr(fim)}`;
  return inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function diaBr(dia: string) {
  return dia.split('-').reverse().join('/');
}

/** Serializa a data persistida sem deslocá-la pelo fuso da máquina; ex.: meia-noite UTC conserva o dia. */
export function diaCivil(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}

/** Inclui dias/meses sem lançamentos; ex.: fevereiro bissexto produz 29 posições. */
export function intervalosSerieFinanceira(periodo: ReturnType<typeof definirPeriodoFinanceiro>) {
  const intervalos: Array<{ inicio: string; fim: string; rotulo: string }> = [];
  let atual = new Date(periodo.gte);
  while (atual < periodo.lt) {
    const seguinte = new Date(atual);
    if (periodo.periodo === 'ANUAL') seguinte.setUTCMonth(seguinte.getUTCMonth() + 1);
    else seguinte.setUTCDate(seguinte.getUTCDate() + 1);
    intervalos.push({
      inicio: diaCivil(atual),
      fim: diaCivil(new Date(seguinte.getTime() - 86400000)),
      rotulo:
        periodo.periodo === 'ANUAL'
          ? atual.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
          : diaBr(diaCivil(atual)).slice(0, 5),
    });
    atual = seguinte;
  }
  return intervalos;
}
