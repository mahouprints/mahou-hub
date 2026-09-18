import type { Filamento } from '@mahou-hub/contracts';
import { custoFilamentosCentavos } from '@mahou-hub/pricing';
import { parseDecimalBr } from './parsing';

export type FilamentoFormulario = Pick<Filamento, 'id' | 'nome' | 'ativo' | 'custoKgCentavos'>;
export type FilamentoLinha = { filamentoId: string; pesoGStr: string };
export type FilamentoComposicao = { filamentoId: string; pesoG: number };
export type ProdutoComComposicao = {
  filamentoId: string;
  pesoG: number | string;
  filamento?: FilamentoFormulario;
  filamentos?: Array<{
    filamentoId: string;
    pesoG: number | string;
    filamento?: FilamentoFormulario;
  }>;
};

/** Abre produtos antigos como uma linha. Ex.: linhasFilamentosDoProduto(produto). */
export function linhasFilamentosDoProduto(produto: ProdutoComComposicao): FilamentoLinha[] {
  const composicao = produto.filamentos?.length
    ? produto.filamentos
    : [{ filamentoId: produto.filamentoId, pesoG: produto.pesoG }];
  return composicao.map((linha) => ({
    filamentoId: linha.filamentoId,
    pesoGStr: String(linha.pesoG).replace('.', ','),
  }));
}

/** Valida cada consumo antes de salvar ou calcular. Ex.: converterFilamentosForm(linhas). */
export function converterFilamentosForm(linhas: FilamentoLinha[]): FilamentoComposicao[] {
  if (linhas.length === 0) throw new Error('Adicione pelo menos um filamento.');
  const escolhidos = new Set<string>();
  return linhas.map((linha, indice) => {
    const pesoG = parseDecimalBr(linha.pesoGStr);
    if (!linha.filamentoId) throw new Error(`Selecione o filamento ${indice + 1}.`);
    if (escolhidos.has(linha.filamentoId))
      throw new Error('Cada filamento deve aparecer uma única vez. Some os pesos na mesma linha.');
    if (!Number.isFinite(pesoG) || pesoG <= 0)
      throw new Error(`Filamento ${indice + 1}: informe um peso maior que zero.`);
    if (Math.abs(pesoG * 100 - Math.round(pesoG * 100)) > 0.000001)
      throw new Error(`Filamento ${indice + 1}: use no máximo duas casas decimais para o peso.`);
    escolhidos.add(linha.filamentoId);
    return { filamentoId: linha.filamentoId, pesoG };
  });
}

/** Soma em centésimos de grama para evitar ruído binário. Ex.: pesoTotalFilamentos(composicao). */
export function pesoTotalFilamentos(composicao: FilamentoComposicao[]): number {
  return composicao.reduce((total, linha) => total + Math.round(linha.pesoG * 100), 0) / 100;
}

/** Preserva o nome e custo dos filamentos desativados já usados. Ex.: filamentosDoFormulario(lista, produto). */
export function filamentosDoFormulario(
  lista: FilamentoFormulario[],
  produto?: ProdutoComComposicao | null,
): FilamentoFormulario[] {
  const opcoes = new Map(lista.map((filamento) => [filamento.id, filamento]));
  const relacionados = [
    produto?.filamento,
    ...(produto?.filamentos?.map((linha) => linha.filamento) ?? []),
  ];
  for (const filamento of relacionados) {
    if (filamento && !opcoes.has(filamento.id)) opcoes.set(filamento.id, filamento);
  }
  return [...opcoes.values()];
}

/** Soma custos brutos e arredonda somente o total. Ex.: custoFilamentosFormulario(linhas, filamentos). */
export function custoFilamentosFormulario(
  linhas: FilamentoLinha[],
  filamentos: FilamentoFormulario[],
): number {
  const composicao = linhas.flatMap((linha) => {
    const filamento = filamentos.find((item) => item.id === linha.filamentoId);
    const pesoG = parseDecimalBr(linha.pesoGStr);
    if (!filamento || !Number.isFinite(pesoG) || pesoG <= 0) return [];
    return [{ pesoG, filamento }];
  });
  return custoFilamentosCentavos(composicao);
}
