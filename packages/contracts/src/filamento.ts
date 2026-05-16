import { z } from 'zod';

export const FilamentoSchema = z.object({
  id: z.string(),
  nome: z.string().min(1),
  custoKgCentavos: z.number().int().nonnegative(),
  potenciaA1W: z.number().int().nonnegative(),
  potenciaH2cW: z.number().int().nonnegative(),
  observacao: z.string().nullable(),
  ativo: z.boolean(),
});

export const FilamentoCreateSchema = FilamentoSchema.omit({ id: true, ativo: true }).extend({
  ativo: z.boolean().default(true),
});

export const FilamentoUpdateSchema = FilamentoCreateSchema.partial();

export type Filamento = z.infer<typeof FilamentoSchema>;
export type FilamentoCreate = z.infer<typeof FilamentoCreateSchema>;
export type FilamentoUpdate = z.infer<typeof FilamentoUpdateSchema>;
