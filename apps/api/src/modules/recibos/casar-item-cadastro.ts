/**
 * Casa a descrição bruta de uma linha da nota com um filamento ou insumo já cadastrado.
 *
 * Deliberadamente burro e conservador: exige que TODAS as palavras do nome cadastrado
 * apareçam na descrição da nota. "PLA Azul Voolt" casa com "FILAMENTO PLA 1KG AZUL VOOLT",
 * mas "PLA Cinza Claro Velvet Voolt" não casa com "FILAMENTO PLA CINZA" — falta "velvet",
 * e cinza claro velvet é rolo diferente de cinza escuro.
 *
 * Não usamos similaridade difusa de propósito. Casar errado aqui move saldo do rolo errado
 * e ninguém percebe até o estoque não bater; não casar apenas faz a tela perguntar.
 */

export interface CandidatoCadastro {
  id: string;
  nome: string;
}

/** Palavras que aparecem em toda nota e não distinguem nada. */
const RUIDO = new Set(['de', 'da', 'do', 'com', 'para', 'kg', 'g', 'un', 'und', 'pc', '3d']);

/**
 * @example casarComCadastro('FILAMENTO PLA 1KG AZUL VOOLT', [{id:'f1', nome:'PLA Azul Voolt'}])
 *          // => 'f1'
 */
export function casarComCadastro(
  descricaoNota: string,
  candidatos: CandidatoCadastro[],
): string | null {
  const palavrasNota = new Set(tokenizar(descricaoNota));
  const casados = candidatos
    .map((c) => ({ id: c.id, tokens: tokenizar(c.nome) }))
    .filter((c) => c.tokens.length > 0 && c.tokens.every((t) => palavrasNota.has(t)));

  if (casados.length === 0) return null;

  // Mais palavras casadas = nome mais específico. "PLA Azul Velvet" ganha de "PLA Azul"
  // quando a nota traz as três.
  const maior = Math.max(...casados.map((c) => c.tokens.length));
  const vencedores = casados.filter((c) => c.tokens.length === maior);
  // Dois cadastros igualmente específicos: ambíguo, quem decide é o Gabriel.
  return vencedores.length === 1 ? (vencedores[0]?.id ?? null) : null;
}

function tokenizar(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !RUIDO.has(t));
}
