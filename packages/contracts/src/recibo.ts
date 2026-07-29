import { z } from 'zod';
import { CategoriaCustoEnum } from './custo';

export const ReciboArquivoSchema = z.object({
  id: z.string(),
  url: z.string(),
  nomeOriginal: z.string(),
  mimeType: z.string(),
  bytes: z.number().int(),
  criadoEm: z.union([z.string(), z.date()]),
});

export const ReciboStatusEnum = z.enum(['PENDENTE', 'EXTRAIDO', 'CONFIRMADO']);
export const ReciboItemTipoEnum = z.enum(['FILAMENTO', 'INSUMO', 'NAO_ESTOCAVEL']);

export const ReciboItemSchema = z.object({
  id: z.string(),
  descricaoNota: z.string(),
  quantidade: z.number().nullable(),
  unidade: z.string().nullable(),
  valorUnitCentavos: z.number().int().nullable(),
  valorTotalCentavos: z.number().int().nullable(),
  tipo: ReciboItemTipoEnum.nullable(),
  categoriaCusto: CategoriaCustoEnum.nullable(),
  filamentoId: z.string().nullable(),
  insumoId: z.string().nullable(),
  gramasTotal: z.number().int().nullable(),
  camposIlegiveis: z.array(z.string()),
  movimentoRegistrado: z.boolean(),
});

export const ReciboSchema = z.object({
  id: z.string(),
  data: z.union([z.string(), z.date()]),
  fornecedor: z.string().nullable(),
  valorCentavos: z.number().int().nullable(),
  observacao: z.string().nullable(),
  status: ReciboStatusEnum,
  extraidoEm: z.union([z.string(), z.date()]).nullable(),
  confirmadoEm: z.union([z.string(), z.date()]).nullable(),
  camposIlegiveis: z.array(z.string()),
  itens: z.array(ReciboItemSchema),
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

/// Correção manual de uma linha na tela de revisão. Tudo opcional: o Gabriel mexe só no
/// que a IA errou ou não leu. Corrigir um campo tira ele de `camposIlegiveis`.
export const ReciboItemUpdateSchema = z.object({
  descricaoNota: z.string().min(1).optional(),
  quantidade: z.number().positive().optional(),
  unidade: z.string().min(1).optional(),
  valorUnitCentavos: z.number().int().nonnegative().nullable().optional(),
  valorTotalCentavos: z.number().int().nonnegative().nullable().optional(),
  tipo: ReciboItemTipoEnum.nullable().optional(),
  categoriaCusto: CategoriaCustoEnum.nullable().optional(),
  filamentoId: z.string().nullable().optional(),
  insumoId: z.string().nullable().optional(),
  gramasTotal: z.number().int().positive().nullable().optional(),
});

export type Recibo = z.infer<typeof ReciboSchema>;
export type ReciboArquivo = z.infer<typeof ReciboArquivoSchema>;
export type ReciboItem = z.infer<typeof ReciboItemSchema>;
export type ReciboCreate = z.infer<typeof ReciboCreateSchema>;
export type ReciboUpdate = z.infer<typeof ReciboUpdateSchema>;
export type ReciboItemUpdate = z.infer<typeof ReciboItemUpdateSchema>;
export type ReciboStatus = z.infer<typeof ReciboStatusEnum>;
export type ReciboItemTipo = z.infer<typeof ReciboItemTipoEnum>;
