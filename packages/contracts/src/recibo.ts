import { z } from 'zod';

export const ReciboArquivoSchema = z.object({
  id: z.string(),
  url: z.string(),
  nomeOriginal: z.string(),
  mimeType: z.string(),
  bytes: z.number().int(),
  criadoEm: z.union([z.string(), z.date()]),
});

export const ReciboSchema = z.object({
  id: z.string(),
  data: z.union([z.string(), z.date()]),
  fornecedor: z.string().nullable(),
  valorCentavos: z.number().int().nullable(),
  observacao: z.string().nullable(),
  arquivos: z.array(ReciboArquivoSchema),
});

export const ReciboCreateSchema = z.object({
  // ISO date string (ex.: "2026-05-11").
  data: z.string().min(1),
  fornecedor: z.string().nullable().optional(),
  valorCentavos: z.number().int().nonnegative().nullable().optional(),
  observacao: z.string().nullable().optional(),
});

export const ReciboUpdateSchema = ReciboCreateSchema.partial();

export type Recibo = z.infer<typeof ReciboSchema>;
export type ReciboArquivo = z.infer<typeof ReciboArquivoSchema>;
export type ReciboCreate = z.infer<typeof ReciboCreateSchema>;
export type ReciboUpdate = z.infer<typeof ReciboUpdateSchema>;
