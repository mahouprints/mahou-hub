import { z } from 'zod';

export const CategoriaCustoEnum = z.enum([
  'ALUGUEL',
  'ENERGIA',
  'INTERNET',
  'SOFTWARE',
  'MARKETING',
  'INSUMOS',
  'IMPOSTOS',
  'OUTROS',
]);

export const CustoSchema = z.object({
  id: z.string(),
  descricao: z.string().min(1),
  categoria: CategoriaCustoEnum,
  valorCentavos: z.number().int().positive(),
  dataCompetencia: z.coerce.date(),
  recorrente: z.boolean(),
  geradoAutomatico: z.boolean(),
  observacao: z.string().nullable(),
});

// Na criação, geradoAutomatico é controlado pelo backend (sempre false na entrada manual).
export const CustoCreateSchema = CustoSchema.omit({ id: true, geradoAutomatico: true });
export const CustoUpdateSchema = CustoCreateSchema.partial();

export type CategoriaCusto = z.infer<typeof CategoriaCustoEnum>;
export type Custo = z.infer<typeof CustoSchema>;
export type CustoCreate = z.infer<typeof CustoCreateSchema>;
export type CustoUpdate = z.infer<typeof CustoUpdateSchema>;
