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
