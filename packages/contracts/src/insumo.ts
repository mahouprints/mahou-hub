import { z } from 'zod';

export const InsumoSchema = z.object({
  id: z.string(),
  nome: z.string().min(1),
  unidade: z.string().min(1),
  custoUnitarioCentavos: z.number().int().positive(),
  observacao: z.string().nullable(),
  ativo: z.boolean(),
});

export const InsumoCreateSchema = InsumoSchema.omit({ id: true, ativo: true }).extend({
  ativo: z.boolean().default(true),
});

export const InsumoUpdateSchema = InsumoCreateSchema.partial();

/** Item de Produto que referencia um Insumo + quantidade consumida por unidade. */
export const ProdutoInsumoInputSchema = z.object({
  insumoId: z.string(),
  qtd: z.number().positive(),
});

export type Insumo = z.infer<typeof InsumoSchema>;
export type InsumoCreate = z.infer<typeof InsumoCreateSchema>;
export type InsumoUpdate = z.infer<typeof InsumoUpdateSchema>;
export type ProdutoInsumoInput = z.infer<typeof ProdutoInsumoInputSchema>;
