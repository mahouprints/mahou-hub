const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const REAIS_SEM_SIMBOLO = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function centavosParaReais(centavos: number): string {
  return REAIS.format(centavos / 100);
}

export function centavosParaReaisSemSimbolo(centavos: number): string {
  return REAIS_SEM_SIMBOLO.format(centavos / 100);
}

export function pct(valor: number, casas = 1): string {
  return `${(valor * 100).toFixed(casas).replace('.', ',')}%`;
}

export function isUrl(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^https?:\/\//i.test(s.trim());
}

const RTF = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

// "há 5 min", "há 2 dias", "agora". Aceita Date | string ISO | null.
export function tempoRelativo(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  const diffSeg = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeg);
  if (abs < 60) return 'agora';
  if (abs < 3600) return RTF.format(Math.round(diffSeg / 60), 'minute');
  if (abs < 86400) return RTF.format(Math.round(diffSeg / 3600), 'hour');
  if (abs < 604800) return RTF.format(Math.round(diffSeg / 86400), 'day');
  if (abs < 2592000) return RTF.format(Math.round(diffSeg / 604800), 'week');
  if (abs < 31536000) return RTF.format(Math.round(diffSeg / 2592000), 'month');
  return RTF.format(Math.round(diffSeg / 31536000), 'year');
}
