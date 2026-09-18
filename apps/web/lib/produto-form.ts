import {
  ProdutoCreateSchema,
  type Produto,
  type Insumo,
  type ProdutoCreate,
  type ProdutoImagem,
} from '@mahou-hub/contracts';
import {
  converterFilamentosForm,
  pesoTotalFilamentos,
  type FilamentoLinha,
  type ProdutoComComposicao,
} from './produto-filamentos';
import { parseDecimalBr, parseDecimalParaCentavos } from './parsing';

/** GET /produtos/:id devolve insumos e imagens populados; declaramos local pra não poluir contracts. */
export type InsumoFormulario = Pick<Insumo, 'id' | 'nome' | 'unidade' | 'custoUnitarioCentavos'>;

export type ProdutoComInsumos = Omit<Produto, 'filamentos'> &
  ProdutoComComposicao & {
    insumos?: Array<{ insumoId: string; qtd: number | string; insumo?: InsumoFormulario }>;
    imagens?: ProdutoImagem[];
  };

export interface InsumoLinha {
  insumoId: string;
  qtdStr: string; // string pro input controlled
}

export interface FormState {
  nome: string;
  inspiracao: string;
  modelo3dUrl: string;
  larguraCm: string;
  alturaCm: string;
  profundidadeCm: string;
  filamentos: FilamentoLinha[];
  tempoH: string;
  impressora: 'A1' | 'H2C';
  embalagemReais: string;
  precoReais: string;
  canalPrincipal: 'SHOPEE' | 'ML' | 'SITE' | 'TIKTOK';
  metodoImagem: 'IA' | 'FOTO' | '';
  insumos: InsumoLinha[];
}

export const PRODUTO_FORM_VAZIO: FormState = {
  nome: '',
  inspiracao: '',
  modelo3dUrl: '',
  larguraCm: '',
  alturaCm: '',
  profundidadeCm: '',
  filamentos: [{ filamentoId: '', pesoGStr: '' }],
  tempoH: '',
  impressora: 'A1',
  // Embalagem default 0: custos pequenos sem rastreio individual ficam nos
  // Insumos cadastrados; quem não usa o campo deixa zerado.
  embalagemReais: '0,00',
  precoReais: '',
  canalPrincipal: 'SHOPEE',
  metodoImagem: '',
  insumos: [],
};

const MENSAGENS_CAMPO: Record<string, string> = {
  nome: 'Informe o nome do produto.',
  filamentoId: 'Selecione um filamento.',
  pesoG: 'Informe um peso maior que zero.',
  tempoH: 'Informe um tempo de impressão maior que zero.',
  embalagemCentavos: 'Informe um custo de embalagem válido, igual ou maior que zero.',
  precoCentavos: 'Informe um preço maior que zero.',
  modelo3dUrl: 'Informe uma URL válida para o modelo 3D ou deixe em branco.',
  larguraCm: 'Informe uma largura maior que zero ou deixe em branco.',
  alturaCm: 'Informe uma altura maior que zero ou deixe em branco.',
  profundidadeCm: 'Informe uma profundidade maior que zero ou deixe em branco.',
};

/** Valida o cadastro sem perder insumos incompletos. Ex.: converterProdutoForm(form). */
export function converterProdutoForm(
  form: FormState,
  produto?: ProdutoComInsumos | null,
): ProdutoCreate {
  const filamentos = converterFilamentosForm(form.filamentos);
  const insumos = form.insumos.map((linha, indice) => {
    const qtd = parseDecimalBr(linha.qtdStr);
    if (!linha.insumoId || !Number.isFinite(qtd) || qtd <= 0) {
      throw new Error(
        `Insumo ${indice + 1}: selecione o insumo e informe a quantidade por unidade maior que zero, ou remova a linha.`,
      );
    }
    return { insumoId: linha.insumoId, qtd };
  });
  const resultado = ProdutoCreateSchema.safeParse({
    nome: form.nome.trim(),
    inspiracao: form.inspiracao.trim() || null,
    modelo3dUrl: form.modelo3dUrl.trim() || null,
    larguraCm: parseDimensaoCm(form.larguraCm),
    alturaCm: parseDimensaoCm(form.alturaCm),
    profundidadeCm: parseDimensaoCm(form.profundidadeCm),
    filamentos,
    filamentoId: filamentos[0]!.filamentoId,
    pesoG: pesoTotalFilamentos(filamentos),
    tempoH: parseDecimalBr(form.tempoH),
    impressora: form.impressora,
    embalagemCentavos: form.embalagemReais.trim()
      ? parseDecimalParaCentavos(form.embalagemReais)
      : 0,
    precoCentavos: parseDecimalParaCentavos(form.precoReais),
    canalPrincipal: form.canalPrincipal,
    metodoImagem: form.metodoImagem || null,
    ativo: produto?.rascunho ? true : (produto?.ativo ?? true),
    anunciado: produto?.anunciado ?? false,
    insumos,
  });
  if (!resultado.success) {
    const campo = String(resultado.error.issues[0]?.path[0]);
    throw new Error(MENSAGENS_CAMPO[campo] ?? 'Confira os dados do produto antes de salvar.');
  }
  return resultado.data;
}

/** Vazio é opcional; números inválidos precisam ser corrigidos, sem descarte silencioso. */
function parseDimensaoCm(valor: string): number | null {
  return valor.trim() ? parseDecimalBr(valor) : null;
}

/** Mantém o custo de insumos já associados mesmo após desativação. Ex.: insumosDoFormulario(ativos, produto). */
export function insumosDoFormulario(
  ativos: InsumoFormulario[],
  produto?: ProdutoComInsumos | null,
): InsumoFormulario[] {
  const opcoes = new Map(ativos.map((insumo) => [insumo.id, insumo]));
  for (const linha of produto?.insumos ?? []) {
    if (linha.insumo && !opcoes.has(linha.insumoId)) opcoes.set(linha.insumoId, linha.insumo);
  }
  return [...opcoes.values()];
}
