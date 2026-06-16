import { z } from 'zod';
import { ImpressoraEnum, JobStatusEnum, OrigemEnum } from './enums';

export const JobProducaoSchema = z.object({
  id: z.string(),
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime().nullable(),
  origem: OrigemEnum,
  produtoId: z.string(),
  qtd: z.number().int().positive(),
  prioridade: z.number().int().default(0),
  impressora: ImpressoraEnum,
  status: JobStatusEnum,
  anuncioCriado: z.boolean(),
  anunciado: z.boolean(),
  observacao: z.string().nullable(),
});

export const JobCreateSchema = JobProducaoSchema.omit({
  id: true,
  dataFim: true,
  status: true,
  anuncioCriado: true,
  anunciado: true,
});

export const JobStatusUpdateSchema = z.object({
  status: JobStatusEnum,
});

// Criação em leva: cada item vira um job/card próprio no kanban (não é 1 job com N produtos).
export const JobBulkCreateSchema = z.object({
  itens: z.array(JobCreateSchema).min(1).max(50),
});

export type JobProducao = z.infer<typeof JobProducaoSchema>;
export type JobCreate = z.infer<typeof JobCreateSchema>;
export type JobStatusUpdate = z.infer<typeof JobStatusUpdateSchema>;
export type JobBulkCreate = z.infer<typeof JobBulkCreateSchema>;
