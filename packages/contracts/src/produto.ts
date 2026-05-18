import { z } from 'zod';
import { CanalEnum, ImpressoraEnum } from './enums';
import { ProdutoInsumoInputSchema } from './insumo';

export const ProdutoSchema = z.object({
  id: z.string(),
  nome: z.string().min(1),
  inspiracao: z.string().nullable(),
  modelo3dUrl: z.string().url().nullable(),
  larguraCm: z.number().positive().nullable(),
  alturaCm: z.number().positive().nullable(),
  profundidadeCm: z.number().positive().nullable(),
  filamentoId: z.string(),
  pesoG: z.number().positive(),
  tempoH: z.number().positive(),
  impressora: ImpressoraEnum,
  embalagemCentavos: z.number().int().nonnegative(),
  precoCentavos: z.number().int().positive(),
  canalPrincipal: CanalEnum,
  ativo: z.boolean(),
  anunciado: z.boolean(),
});

export const ProdutoCreateSchema = ProdutoSchema.omit({
  id: true,
  ativo: true,
  anunciado: true,
}).extend({
  ativo: z.boolean().default(true),
  anunciado: z.boolean().default(false),
  insumos: z.array(ProdutoInsumoInputSchema).optional(),
});

export const ProdutoUpdateSchema = ProdutoCreateSchema.partial();

export type Produto = z.infer<typeof ProdutoSchema>;
export type ProdutoCreate = z.infer<typeof ProdutoCreateSchema>;
export type ProdutoUpdate = z.infer<typeof ProdutoUpdateSchema>;

export const EstatisticasProdutoSchema = z.object({
  vendidos: z.number().int().nonnegative(),
  qtdVendas: z.number().int().nonnegative(),
  faturamentoCentavos: z.number().int().nonnegative(),
  ultimaVendaEm: z.coerce.date().nullable(),
  produzidos: z.number().int().nonnegative(),
  emProducao: z.number().int().nonnegative(),
});
export type EstatisticasProduto = z.infer<typeof EstatisticasProdutoSchema>;
