import { z } from 'zod';

export const CategoriaCustoEnum = z.enum([
  'ALUGUEL',
  'ENERGIA',
  'INTERNET',
  'SOFTWARE',
  'ASSINATURA',
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

/**
 * Na criação, `geradoAutomatico` é controlado pelo backend (sempre false na entrada manual).
 * `mesesRecorrencia` só é usado quando `recorrente=true` — define quantas cópias mensais
 * são geradas no futuro (1..60). Default no service é 12. Ignorado em update.
 */
export const CustoCreateSchema = CustoSchema.omit({ id: true, geradoAutomatico: true }).extend({
  mesesRecorrencia: z.number().int().min(1).max(60).optional(),
});
export const CustoUpdateSchema = CustoCreateSchema.partial();

export type CategoriaCusto = z.infer<typeof CategoriaCustoEnum>;
export type Custo = z.infer<typeof CustoSchema>;
export type CustoCreate = z.infer<typeof CustoCreateSchema>;
export type CustoUpdate = z.infer<typeof CustoUpdateSchema>;
