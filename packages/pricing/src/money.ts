/**
 * Arredonda para o centavo mais próximo (half-away-from-zero).
 * Usado em todo cálculo intermediário para manter Int no banco e API.
 */
export function arredondarCentavos(valor: number): number {
  return Math.round(valor);
}

/**
 * Converte reais em centavos. Aceita number (R$ 35.50) e string ("35,50" ou "35.50").
 * Conversão só na borda (input do usuário); internamente tudo é Int de centavos.
 */
export function reaisParaCentavos(reais: number | string): number {
  const numero = typeof reais === 'string' ? Number(reais.replace(',', '.')) : reais;
  if (!Number.isFinite(numero)) {
    throw new Error(`Valor monetário inválido: recebi ${reais}, esperava number ou string numérica`);
  }
  return Math.round(numero * 100);
}

export function centavosParaReais(centavos: number): number {
  return centavos / 100;
}
