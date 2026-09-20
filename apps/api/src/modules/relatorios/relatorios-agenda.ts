import type { RelatorioFinanceiroQuery } from '@mahou-hub/contracts';

const DIA = 86400000;

/** Encontra fechamentos após o cursor, inclusive os perdidos durante indisponibilidade. */
export function relatoriosVencidos(agora: Date, desde: Date): RelatorioFinanceiroQuery[] {
  const resultado: RelatorioFinanceiroQuery[] = [];
  // Bahia usa UTC−3. Cada data civil de fechamento ocorre às 11:00 UTC (08:00 local).
  const data = new Date(desde.getTime() - 3 * 3600000);
  data.setUTCHours(11, 0, 0, 0);
  while (data <= agora) {
    if (data > desde) adicionarFechamentos(data, resultado);
    data.setUTCDate(data.getUTCDate() + 1);
  }
  return resultado;
}

function adicionarFechamentos(data: Date, resultado: RelatorioFinanceiroQuery[]) {
  const referencia = new Date(data.getTime() - DIA).toISOString().slice(0, 10);
  if (data.getUTCDay() === 1) resultado.push({ periodo: 'SEMANAL', referencia });
  if (data.getUTCDate() === 1) resultado.push({ periodo: 'MENSAL', referencia });
  if (data.getUTCDate() === 1 && data.getUTCMonth() === 0)
    resultado.push({ periodo: 'ANUAL', referencia });
}
