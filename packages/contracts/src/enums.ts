import { z } from 'zod';

export const ImpressoraEnum = z.enum(['A1', 'H2C']);
export const CanalEnum = z.enum(['SHOPEE', 'ML', 'SITE']);
export const VendedorShopeeEnum = z.enum(['CNPJ', 'CPF_BAIXO', 'CPF_ALTO']);
export const OrigemEnum = z.enum(['ML', 'SHOPEE', 'SITE', 'ESTOQUE']);
export const JobStatusEnum = z.enum([
  'FILA',
  'IMPRIMINDO',
  'CONCLUIDO',
  'EMBALADO',
  'ENVIADO',
  'CANCELADO',
]);
export const IdeiaStatusEnum = z.enum(['BACKLOG', 'EM_ESTUDO', 'EM_PROD', 'ARQUIVADA']);

export type Impressora = z.infer<typeof ImpressoraEnum>;
export type Canal = z.infer<typeof CanalEnum>;
export type VendedorShopee = z.infer<typeof VendedorShopeeEnum>;
export type Origem = z.infer<typeof OrigemEnum>;
export type JobStatus = z.infer<typeof JobStatusEnum>;
export type IdeiaStatus = z.infer<typeof IdeiaStatusEnum>;
