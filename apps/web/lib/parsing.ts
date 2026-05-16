/**
 * Aceita `35,00`, `35.00`, `1.234,56` (BR), `1234.56`. Retorna NaN se inválido.
 * Heurística: se tem ',' e '.', assume '.' é separador de milhar e ',' decimal.
 * Se só tem ',', vira decimal. Se só tem '.', mantém como decimal.
 */
export function parseDecimalBr(input: string): number {
  if (!input || typeof input !== 'string') return NaN;
  const s = input.trim().replace(/R\$\s*/i, '').replace(/\s+/g, '');
  if (!s) return NaN;

  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');

  let normalizado: string;
  if (temVirgula && temPonto) {
    normalizado = s.replace(/\./g, '').replace(',', '.');
  } else if (temVirgula) {
    normalizado = s.replace(',', '.');
  } else {
    normalizado = s;
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}

export function parseDecimalParaCentavos(input: string): number {
  const n = parseDecimalBr(input);
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * 100);
}
