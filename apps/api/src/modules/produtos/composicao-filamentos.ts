import { BadRequestException } from '@nestjs/common';
import type { ProdutoFilamentoInput, ProdutoUpdate } from '@mahou-hub/contracts';

type ProdutoAtual = {
  filamentoId: string;
  pesoG: { toString(): string };
  filamentos?: Array<{ filamentoId: string; pesoG: { toString(): string } }>;
};

/** A composição é a fonte do peso total e do filamento de referência de energia. */
export function dadosComposicao(filamentos?: ProdutoFilamentoInput[]) {
  const primeiro = filamentos?.[0];
  if (!primeiro) return {};
  return {
    filamentoId: primeiro.filamentoId,
    pesoG: Math.round(filamentos!.reduce((total, item) => total + item.pesoG, 0) * 100) / 100,
  };
}

export function composicaoParaAtualizar(atual: ProdutoAtual, data: ProdutoUpdate) {
  if (data.filamentos) return data.filamentos;
  const mudouLegado =
    (data.filamentoId !== undefined && data.filamentoId !== atual.filamentoId) ||
    (data.pesoG !== undefined && data.pesoG !== Number(atual.pesoG));
  if (!mudouLegado || !atual.filamentos?.length) return undefined;
  if (atual.filamentos.length > 1) {
    throw new BadRequestException(
      'Este produto usa vários filamentos; edite a composição completa',
    );
  }
  return [
    {
      filamentoId: data.filamentoId ?? atual.filamentoId,
      pesoG: data.pesoG ?? Number(atual.pesoG),
    },
  ];
}

export function linhasComposicao(filamentos: ProdutoFilamentoInput[]) {
  return filamentos.map((item, ordem) => ({ ...item, ordem }));
}
