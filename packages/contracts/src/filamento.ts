import { z } from 'zod';

export const FilamentoSchema = z.object({
  id: z.string(),
  nome: z.string().min(1),
  custoKgCentavos: z.number().int().nonnegative(),
  potenciaA1W: z.number().int().nonnegative(),
  potenciaH2cW: z.number().int().nonnegative(),
  observacao: z.string().nullable(),
  ativo: z.boolean(),
  // Saldo em gramas (somente leitura — muda via movimento de estoque).
  estoqueGramas: z.number().nonnegative(),
  // Limiar de alerta de reposição, em gramas.
  estoqueMinGramas: z.number().nonnegative(),
});

export const FilamentoCreateSchema = FilamentoSchema.omit({
  id: true,
  ativo: true,
  estoqueGramas: true,
  estoqueMinGramas: true,
}).extend({
  ativo: z.boolean().default(true),
  estoqueMinGramas: z.number().nonnegative().optional(),
});

export const FilamentoUpdateSchema = FilamentoCreateSchema.partial();

export type Filamento = z.infer<typeof FilamentoSchema>;
export type FilamentoCreate = z.infer<typeof FilamentoCreateSchema>;
export type FilamentoUpdate = z.infer<typeof FilamentoUpdateSchema>;
