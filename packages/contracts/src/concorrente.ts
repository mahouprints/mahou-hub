import { z } from 'zod';

export const ConcorrenteSchema = z.object({
  id: z.string(),
  loja: z.string().min(1),
  instagram: z.string().nullable(),
  website: z.string().url().nullable(),
  observacao: z.string().nullable(),
});

export const ConcorrenteCreateSchema = ConcorrenteSchema.omit({ id: true });

export const PrecoConcorrenteSchema = z.object({
  id: z.string(),
  concorrenteId: z.string(),
  produtoSimilar: z.string().min(1),
  precoCentavos: z.number().int().positive(),
  capturadoEm: z.string().datetime(),
  fonteUrl: z.string().url().nullable(),
});

export const PrecoConcorrenteCreateSchema = PrecoConcorrenteSchema.omit({
  id: true,
  capturadoEm: true,
});

export type Concorrente = z.infer<typeof ConcorrenteSchema>;
export type ConcorrenteCreate = z.infer<typeof ConcorrenteCreateSchema>;
export type PrecoConcorrente = z.infer<typeof PrecoConcorrenteSchema>;
export type PrecoConcorrenteCreate = z.infer<typeof PrecoConcorrenteCreateSchema>;
