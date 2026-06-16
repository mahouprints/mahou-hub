import { z } from 'zod';
import { ImpressoraEnum, JobStatusEnum, OrigemEnum } from './enums';

export const JobProducaoSchema = z.object({
  id: z.string(),
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime().nullable(),
  origem: OrigemEnum,
  produtoId: z.string(),
  // Variação (cor) opcional. Null = produto sem variação.
  variacaoId: z.string().nullable(),
  qtd: z.number().int().positive(),
  prioridade: z.number().int().default(0),
  impressora: ImpressoraEnum,
  status: JobStatusEnum,
  // Card atendido pelo estoque de peças prontas (pula impressão). Server-side.
  daEstoque: z.boolean(),
  consumoProdutoRegistrado: z.boolean(),
  anuncioCriado: z.boolean(),
  anunciado: z.boolean(),
  observacao: z.string().nullable(),
});

// No create o cliente manda só a quantidade desejada por variação; o split
// (fromStock/toPrint) e as flags daEstoque/consumoProdutoRegistrado são do servidor.
export const JobCreateSchema = JobProducaoSchema.omit({
  id: true,
  dataFim: true,
  status: true,
  daEstoque: true,
  consumoProdutoRegistrado: true,
  anuncioCriado: true,
  anunciado: true,
}).extend({
  variacaoId: z.string().nullable().optional(),
});

export const JobStatusUpdateSchema = z.object({
  status: JobStatusEnum,
});

// Criação em leva: cada item vira um job/card próprio no kanban (não é 1 job com N produtos).
export const JobBulkCreateSchema = z.object({
  itens: z.array(JobCreateSchema).min(1).max(50),
});

// Histórico de produção agregado no tempo (gráfico). `inicio` é o começo do bucket.
export const HistoricoPeriodoEnum = z.enum(['diario', 'semanal', 'mensal', 'anual']);
export const ProducaoHistoricoBucketSchema = z.object({
  inicio: z.string(),
  total: z.number().int().nonnegative(),
});

export type JobProducao = z.infer<typeof JobProducaoSchema>;
export type JobCreate = z.infer<typeof JobCreateSchema>;
export type JobStatusUpdate = z.infer<typeof JobStatusUpdateSchema>;
export type JobBulkCreate = z.infer<typeof JobBulkCreateSchema>;
export type HistoricoPeriodo = z.infer<typeof HistoricoPeriodoEnum>;
export type ProducaoHistoricoBucket = z.infer<typeof ProducaoHistoricoBucketSchema>;
