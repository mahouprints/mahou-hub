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

/**
 * Palavras que não distinguem produto nenhum e só gastam caractere.
 *
 * A segunda leva é ruído de TÍTULO DE ANÚNCIO: o nome do produto aqui costuma ser a
 * copy inteira da Shopee ("Dragao Flexivel Articulado Impressao 3D Brinquedo Antistress
 * Fidget Dino Enfeite Mesa Presente"), e sem podar isso o SKU vira sopa de sigla.
 */
const RUIDO = new Set([
  'de', 'da', 'do', 'dos', 'das', 'para', 'com', 'em', 'e', 'o', 'a', 'no', 'na',
  'impressao', 'impressa', '3d', 'brinquedo', 'presente', 'enfeite', 'decorativo',
  'decoracao', 'mesa', 'casa', 'original', 'personalizado', 'divertido',
]);

/** Quantas palavras do nome entram no código. Além de três, ninguém lê mesmo. */
const MAX_PALAVRAS = 3;

/**
 * Cor → sigla. Existe porque o nome da variação JÁ é a cor: exigir que o Gabriel
 * cadastre a sigla em cada filamento antes de gerar SKU decente é pedir trabalho por uma
 * informação que já está na mão.
 */
const SIGLAS_DE_COR: Record<string, string> = {
  branco: 'BR', preto: 'PT', vermelho: 'VM', azul: 'AZ', verde: 'VD', amarelo: 'AM',
  rosa: 'RS', roxo: 'RX', lilas: 'LI', laranja: 'LR', cinza: 'CZ', marrom: 'MR',
  dourado: 'DR', prata: 'PA', prateado: 'PA', bege: 'BG', vinho: 'VN', turquesa: 'TQ',
  salmao: 'SM', nude: 'ND', transparente: 'TP', natural: 'NT', ciano: 'CI',
  magenta: 'MG', bronze: 'BZ', cobre: 'CB', oliva: 'OL', creme: 'CR',
};

/**
 * Sigla de 2-3 letras pra uma cor escrita por extenso. Cor conhecida usa a sigla do mapa;
 * o resto vira as consoantes iniciais ("Rose Gold" → "RSG"), que ainda se lê.
 */
/**
 * Material, acabamento e marca não são cor. Sem tirá-los, "PLA Rose Gold Voolt" vira
 * "PLR" (consoantes de PLA+ROSE) em vez de "RSG".
 */
const NAO_E_COR = new Set([
  'pla', 'petg', 'abs', 'asa', 'tpu', 'pet', 'hf', 'plus', 'basic',
  'voolt', 'velvet', 'silk', 'matte', 'fosco', 'brilhante', 'off',
]);

export function siglaDaCor(nome: string): string {
  const palavras = nome
    .split(/\s+/)
    .map((p) => normalizar(p).toLowerCase())
    .filter((p) => p && !NAO_E_COR.has(p));
  if (palavras.length === 0) return '';

  // Varre todas as palavras porque o nome do filamento traz material e marca junto:
  // "PLA Branco OFF White Velvet Voolt" tem a cor no meio, não no começo.
  for (const p of palavras) {
    const doMapa = SIGLAS_DE_COR[p];
    if (doMapa) return doMapa;
  }

  // Cor fora do mapa ("Rose Gold"): consoantes das duas primeiras palavras ainda se lê.
  const juntas = palavras.slice(0, 2).join('').toUpperCase();
  const semVogais = juntas.replace(/[AEIOU]/g, '');
  return (semVogais || juntas).slice(0, 3);
}

/**
 * @example gerarSku('Suporte de Móbile de Berço', 'AZ') // => 'SUPORTE-MOBILE-BERCO-AZ'
 * @example gerarSku('Cortador de Biscoito Patrulha Canina', 'VD') // => 'CORTA-BISCO-PATRU-CANIN-VD'
 */
export function gerarSku(nomeProduto: string, siglaCor?: string | null): string {
  const cor = normalizar(siglaCor ?? '').slice(0, 3);
  const sufixo = cor ? `-${cor}` : '';
  const palavras = separarPalavras(nomeProduto).slice(0, MAX_PALAVRAS);
  if (palavras.length === 0) return cor || 'SKU';

  const espacoBase = SKU_MAX - sufixo.length;

  // Menos palavras inteiras ganha de mais palavras espremidas: "DRAGAO-FLEXIVEL-BR" diz
  // o que é; "DRA-FLE-ART-IMP-3D" não diz nada. Só encurta letra quando nem duas palavras
  // inteiras cabem.
  for (let quantas = palavras.length; quantas >= 1; quantas--) {
    const base = palavras.slice(0, quantas).join('-');
    if (base.length <= espacoBase) return `${base}${sufixo}`;
  }

  for (const tamanho of [8, 6, 5, 4, 3]) {
    const base = palavras.map((p) => p.slice(0, tamanho)).join('-');
    if (base.length <= espacoBase) return `${base}${sufixo}`;
  }

  return `${palavras[0]!.slice(0, espacoBase)}${sufixo}`;
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
