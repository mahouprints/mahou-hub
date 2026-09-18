import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

type Peso = Prisma.Decimal | number | string;
type ProdutoComReceita = {
  filamentoId: string;
  pesoG: Peso;
  filamentos?: Array<{ filamentoId: string; pesoG: Peso }>;
};
type VariacaoComConsumo = { filamentoId?: string | null; pesoG?: Peso | null } | null;

const ConsumoFilamentosSchema = z.array(
  z.object({ filamentoId: z.string().min(1), gramas: z.number().positive().finite() }),
);
export type ConsumoFilamento = z.infer<typeof ConsumoFilamentosSchema>[number];

/** Usa cada peso cadastrado por unidade; ex.: receita de 10 g + 2,5 g × 3 peças. */
export function calcularConsumoFilamentos(
  produto: ProdutoComReceita,
  variacao: VariacaoComConsumo,
  qtd: number,
): ConsumoFilamento[] {
  const receita = produto.filamentos?.length
    ? produto.filamentos
    : [{ filamentoId: produto.filamentoId, pesoG: produto.pesoG }];
  if (receita.length > 1) validarVariacaoComReceita(receita, variacao);
  return receita
    .map((item) => ({
      filamentoId:
        receita.length === 1 ? (variacao?.filamentoId ?? item.filamentoId) : item.filamentoId,
      gramas: new Prisma.Decimal(
        receita.length === 1 ? (variacao?.pesoG ?? item.pesoG) : item.pesoG,
      )
        .mul(qtd)
        .toDecimalPlaces(2)
        .toNumber(),
    }))
    .filter((item) => item.gramas > 0);
}

function validarVariacaoComReceita(receita: Array<{ pesoG: Peso }>, variacao: VariacaoComConsumo) {
  if (variacao?.filamentoId) {
    throw new BadRequestException(
      `Variação com filamento ${variacao.filamentoId} em produto com ${receita.length} filamentos: ` +
        'selecione "Herdar do produto" para preservar a composição antes de concluir a impressão.',
    );
  }
  const pesoReceita = receita.reduce(
    (total, item) => total.plus(item.pesoG),
    new Prisma.Decimal(0),
  );
  if (variacao?.pesoG != null && !pesoReceita.equals(variacao.pesoG)) {
    throw new BadRequestException(
      `Variação com peso ${variacao.pesoG} g difere da receita de ${pesoReceita} g: ` +
        'remova o peso próprio da variação ou cadastre a composição com os pesos por filamento.',
    );
  }
}

/** Estorna o consumo registrado, mesmo após edição da receita; ex.: snapshot da primeira impressão. */
export function consumoParaEstorno(
  snapshot: Prisma.JsonValue | null | undefined,
  produto: ProdutoComReceita,
  variacao: VariacaoComConsumo,
  qtd: number,
): ConsumoFilamento[] {
  if (snapshot != null) {
    const validado = ConsumoFilamentosSchema.safeParse(snapshot);
    if (!validado.success) {
      throw new BadRequestException(
        'Consumo de filamentos do job inválido; esperado filamentoId e gramas positivos.',
      );
    }
    return validado.data;
  }
  // Jobs anteriores à composição baixavam um único rolo, arredondando para gramas
  // inteiros. Aplicar a receita atual nesse legado devolveria material nunca usado.
  const gramas = Math.round(Number(variacao?.pesoG ?? produto.pesoG) * qtd);
  return gramas > 0 ? [{ filamentoId: variacao?.filamentoId ?? produto.filamentoId, gramas }] : [];
}

/** Soma gramas com precisão do saldo; ex.: 0,1 g + 0,2 g = 0,3 g. */
export function somarConsumoFilamentos(consumo: ConsumoFilamento[]): number {
  return consumo.reduce((total, item) => total.plus(item.gramas), new Prisma.Decimal(0)).toNumber();
}
