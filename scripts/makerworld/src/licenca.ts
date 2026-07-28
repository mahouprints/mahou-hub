// Classificação de licença — o filtro que decide se um modelo pode virar produto na Shopee.
//
// POR QUE ISSO É O PRIMEIRO FILTRO: numa amostra dos 200 modelos mais baixados de
// "Brinquedos e Jogos" (2026-07-27), 149 estavam sob "Standard Digital File License",
// que proíbe explicitamente cobrar pelo objeto impresso. Somando as CC não-comerciais e
// a MakerWorld Exclusive, ~91% do acervo é invendável. Rodar IA antes deste filtro
// desperdiça ~91% do orçamento de avaliação — e listar um modelo proibido expõe a loja
// a takedown do autor.
//
// O texto que a própria API devolve pra Standard Digital File License não deixa margem:
// "Os objetos não podem ser utilizados sem permissão em qualquer circunstância que
// envolva cobrança de taxas ou pagamento."

export type VeredictoLicenca = 'LIVRE' | 'ATRIBUICAO' | 'SEM_DERIVADAS' | 'PROIBIDA';

export interface AnaliseLicenca {
  veredicto: VeredictoLicenca;
  vendavel: boolean;
  /** Preenchido quando a licença exige creditar o autor no anúncio. */
  exigeCredito: boolean;
  /** O que o Gabriel precisa fazer pra ficar em conformidade, em pt-BR. */
  obrigacao: string;
}

// Chave = string exata do campo `license` da API. Comparação é feita em maiúsculas
// e sem espaços nas bordas — o MakerWorld não é consistente com o casing.
const TABELA: Record<string, AnaliseLicenca> = {
  CC0: {
    veredicto: 'LIVRE',
    vendavel: true,
    exigeCredito: false,
    obrigacao: 'Domínio público. Pode vender, modificar e remixar sem creditar.',
  },
  BY: {
    veredicto: 'ATRIBUICAO',
    vendavel: true,
    exigeCredito: true,
    obrigacao: 'Pode vender e modificar. Credite o autor na descrição do anúncio.',
  },
  'BY-SA': {
    veredicto: 'ATRIBUICAO',
    vendavel: true,
    exigeCredito: true,
    obrigacao:
      'Pode vender. Credite o autor. Se publicar um remix do arquivo, ele tem que sair sob BY-SA também (vender a peça impressa não conta como remix).',
  },
  'BY-ND': {
    veredicto: 'SEM_DERIVADAS',
    vendavel: true,
    exigeCredito: true,
    obrigacao:
      'Pode vender a peça impressa sem alterar o modelo. Credite o autor. NÃO publique nem venda versões modificadas.',
  },
  'BY-NC': {
    veredicto: 'PROIBIDA',
    vendavel: false,
    exigeCredito: false,
    obrigacao: 'Não-comercial: proibido vender.',
  },
  'BY-NC-SA': {
    veredicto: 'PROIBIDA',
    vendavel: false,
    exigeCredito: false,
    obrigacao: 'Não-comercial: proibido vender.',
  },
  'BY-NC-ND': {
    veredicto: 'PROIBIDA',
    vendavel: false,
    exigeCredito: false,
    obrigacao: 'Não-comercial: proibido vender.',
  },
  'STANDARD DIGITAL FILE LICENSE': {
    veredicto: 'PROIBIDA',
    vendavel: false,
    exigeCredito: false,
    obrigacao:
      'Licença padrão do MakerWorld: proíbe expressamente qualquer uso que envolva cobrança.',
  },
  'MAKERWORLD EXCLUSIVE LICENSE': {
    veredicto: 'PROIBIDA',
    vendavel: false,
    exigeCredito: false,
    obrigacao: 'Exclusiva do MakerWorld: proibido redistribuir ou vender.',
  },
};

/**
 * Traduz o campo `license` da API num veredicto comercial.
 * Licença desconhecida cai em PROIBIDA de propósito — o custo de errar pra mais
 * (perder um modelo bom) é menor que o de errar pra menos (takedown na Shopee).
 *
 * @example
 * analisarLicenca('BY-NC-SA').vendavel // false
 */
export function analisarLicenca(license: string | undefined | null): AnaliseLicenca {
  const chave = (license ?? '').trim().toUpperCase();
  const encontrada = TABELA[chave];
  if (encontrada) return encontrada;

  return {
    veredicto: 'PROIBIDA',
    vendavel: false,
    exigeCredito: false,
    obrigacao: `Licença não reconhecida ("${license ?? 'vazia'}") — tratada como proibida até revisão manual.`,
  };
}

/** Atalho pro filtro de coleta. */
export function podeVender(license: string | undefined | null): boolean {
  return analisarLicenca(license).vendavel;
}
