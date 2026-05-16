const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function centavosParaReais(centavos: number): string {
  return REAIS.format(centavos / 100);
}

export function pct(valor: number, casas = 1): string {
  return `${(valor * 100).toFixed(casas)}%`;
}
