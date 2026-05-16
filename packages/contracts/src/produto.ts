import { z } from 'zod';
import { CanalEnum, ImpressoraEnum } from './enums.js';

export const ProdutoSchema = z.object({
  id: z.string(),
  nome: z.string().min(1),
  inspiracao: z.string().nullable(),
  modelo3dUrl: z.string().url().nullable(),
  filamentoId: z.string(),
  pesoG: z.number().positive(),
  tempoH: z.number().positive(),
  impressora: ImpressoraEnum,
  embalagemCentavos: z.number().int().nonnegative(),
  precoCentavos: z.number().int().positive(),
  canalPrincipal: CanalEnum,
  ativo: z.boolean(),
});

export const ProdutoCreateSchema = ProdutoSchema.omit({ id: true, ativo: true }).extend({
  ativo: z.boolean().default(true),
});

export const ProdutoUpdateSchema = ProdutoCreateSchema.partial();

export type Produto = z.infer<typeof ProdutoSchema>;
export type ProdutoCreate = z.infer<typeof ProdutoCreateSchema>;
export type ProdutoUpdate = z.infer<typeof ProdutoUpdateSchema>;
