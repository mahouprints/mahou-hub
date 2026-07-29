import { z } from 'zod';

export const TipoItemEstoqueEnum = z.enum(['PRODUTO', 'FILAMENTO', 'INSUMO']);
export const MotivoMovimentoEnum = z.enum([
  'ESTOQUE_INICIAL',
  'COMPRA',
  'PRODUCAO',
  'VENDA',
  'AJUSTE',
  'PERDA',
]);

/**
 * Registra um lançamento no histórico de estoque. `quantidade` é com sinal:
 * positivo = entrada, negativo = saída. Exatamente um id deve casar com `tipoItem`
 * (PRODUTO→variacaoId, FILAMENTO→filamentoId, INSUMO→insumoId). Para PRODUTO a
 * quantidade precisa ser inteira (peças não fracionam).
 */
export const MovimentoCreateSchema = z
  .object({
    tipoItem: TipoItemEstoqueEnum,
    variacaoId: z.string().optional(),
    filamentoId: z.string().optional(),
    insumoId: z.string().optional(),
    quantidade: z.number().refine((n) => n !== 0, 'quantidade não pode ser zero'),
    motivo: MotivoMovimentoEnum,
    custoUnitCentavos: z.number().int().nonnegative().nullable().optional(),
    observacao: z.string().max(500).nullable().optional(),
    // Preenchido quando a entrada veio de nota escaneada — o histórico usa pra linkar
    // o saldo de volta à nota que o originou.
    reciboId: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    const idPorTipo: Record<z.infer<typeof TipoItemEstoqueEnum>, string | undefined> = {
      PRODUTO: v.variacaoId,
      FILAMENTO: v.filamentoId,
      INSUMO: v.insumoId,
    };
    if (!idPorTipo[v.tipoItem]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `tipoItem=${v.tipoItem} exige o id correspondente (variacaoId/filamentoId/insumoId)`,
        path: ['tipoItem'],
      });
    }
    if (v.tipoItem === 'PRODUTO' && !Number.isInteger(v.quantidade)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'quantidade de produto pronto precisa ser um número inteiro',
        path: ['quantidade'],
      });
    }
  });

export type TipoItemEstoque = z.infer<typeof TipoItemEstoqueEnum>;
export type MotivoMovimento = z.infer<typeof MotivoMovimentoEnum>;
export type MovimentoCreate = z.infer<typeof MovimentoCreateSchema>;
