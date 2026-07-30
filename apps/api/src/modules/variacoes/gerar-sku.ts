/**
 * Monta o código de SKU a partir do nome do produto e da sigla da cor.
 *
 * O código é falante de propósito: o Gabriel separa pedido na bancada com três peças
 * parecidas na mesa, e um código opaco (`MH-0042`) obrigaria a consultar o sistema pra
 * conferir o que está embalando — exatamente o erro que o SKU deveria evitar.
 *
 * Formato: `PALAVRA-PALAVRA-COR`, maiúsculas, só A-Z/0-9/hífen, teto de 24 caracteres.
 * Os marketplaces aceitam bem mais (Shopee e ML vão a 100), mas o teto aqui é a etiqueta
 * e a planilha de importação, que truncam sem avisar.
 */

import { SKU_FORMATO, SKU_MAX } from '@mahou-hub/contracts';

/** Palavras que não distinguem produto nenhum e só gastam caractere. */
const RUIDO = new Set(['de', 'da', 'do', 'dos', 'das', 'para', 'com', 'em', 'e', 'o', 'a', 'no', 'na']);

/**
 * @example gerarSku('Suporte de Móbile de Berço', 'AZ') // => 'SUPORTE-MOBILE-BERCO-AZ'
 * @example gerarSku('Cortador de Biscoito Patrulha Canina', 'VD') // => 'CORTA-BISCO-PATRU-CANIN-VD'
 */
export function gerarSku(nomeProduto: string, siglaCor?: string | null): string {
  const cor = normalizar(siglaCor ?? '').slice(0, 3);
  const sufixo = cor ? `-${cor}` : '';
  const palavras = separarPalavras(nomeProduto);
  if (palavras.length === 0) return cor || 'SKU';

  const espacoBase = SKU_MAX - sufixo.length;

  // Tenta com as palavras inteiras; só encurta se não couber. Encurtar é degradação
  // controlada — perder o fim da palavra ainda deixa o código legível ("BISCO" lê-se
  // biscoito), enquanto cortar o SKU no meio deixaria dois produtos com o mesmo prefixo.
  for (const tamanho of [99, 6, 5, 4, 3]) {
    const base = palavras.map((p) => p.slice(0, tamanho)).join('-');
    if (base.length <= espacoBase) return `${base}${sufixo}`;
  }

  // Nome exageradamente longo: corta palavras do fim até caber, preservando as primeiras,
  // que são as que identificam o produto.
  const curtas = palavras.map((p) => p.slice(0, 3));
  let base = curtas.join('-');
  while (base.length > espacoBase && curtas.length > 1) {
    curtas.pop();
    base = curtas.join('-');
  }
  return `${base.slice(0, espacoBase)}${sufixo}`;
}

/** Diz por que um SKU digitado à mão é inválido, ou null se estiver bom. */
export function validarSku(sku: string): string | null {
  if (sku.length > SKU_MAX) return `SKU tem ${sku.length} caracteres; o limite é ${SKU_MAX}`;
  if (!SKU_FORMATO.test(sku)) {
    return 'SKU aceita só letras maiúsculas, números e hífen (ex: SUPORTE-MOBILE-AZ)';
  }
  return null;
}

function separarPalavras(texto: string): string[] {
  return texto
    .split(/\s+/)
    .filter((p) => !RUIDO.has(p.toLowerCase()))
    .map(normalizar)
    .filter((p) => p.length > 0);
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
