import { z } from 'zod';

// IDs grandes (shopId, itemId — Int64 da Shopee) viajam como string no JSON:
// BigInt em JS não serializa em JSON.stringify e perde precisão > 2^53.
const BigIntString = z.string().regex(/^\d+$/, 'esperado inteiro positivo como string');

const DecimalString = z.string().regex(/^-?\d+(\.\d+)?$/);

export const SyncOrigemSchema = z.enum(['MANUAL', 'CRON']);
export type SyncOrigem = z.infer<typeof SyncOrigemSchema>;

// Concorrente "base" — cadastro pode ser manual (sem Shopee) ou via link (com shopId).
export const ConcorrenteSchema = z.object({
  id: z.string(),
  loja: z.string().min(1),
  instagram: z.string().nullable(),
  website: z.string().url().nullable(),
  observacao: z.string().nullable(),
  // Campos Shopee preenchidos quando o concorrente foi criado/atualizado via API de afiliados.
  shopId: BigIntString.nullable(),
  username: z.string().nullable(),
  urlOriginal: z.string().nullable(),
  imageUrl: z.string().nullable(),
  ratingStar: DecimalString.nullable(),
  commissionRatePadrao: DecimalString.nullable(),
  sellerCommCoveRatio: DecimalString.nullable(),
  ultimoSyncEm: z.string().datetime().nullable(),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
});

// Criação manual (sem integração Shopee). Mesmo schema antigo.
export const ConcorrenteCreateSchema = z.object({
  loja: z.string().min(1),
  instagram: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  observacao: z.string().nullable().optional(),
});

// Criação via link Shopee. Backend resolve username + faz primeiro sync.
export const ConcorrenteCreateFromLinkSchema = z.object({
  url: z.string().url().refine(
    (u) => u.includes('shopee.com.br'),
    'URL precisa ser de shopee.com.br',
  ),
});

// Linka concorrente EXISTENTE (cadastro manual) a uma loja Shopee via URL,
// populando shopId/username/urlOriginal e disparando o primeiro sync.
export const ConcorrenteLinkShopeeSchema = ConcorrenteCreateFromLinkSchema;

export const ConcorrenteUpdateSchema = ConcorrenteCreateSchema.partial();

// PrecoConcorrente é o cadastro manual antigo de preços de concorrência. Convive com
// snapshot Shopee — Concorrente pode ter os dois (entradas manuais + sync automático).
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

// Snapshot: 1 linha por execução de sync (manual ou cron). Histórico mantido pra timeline.
export const ConcorrenteSnapshotSchema = z.object({
  id: z.string(),
  concorrenteId: z.string(),
  sincronizadoEm: z.string().datetime(),
  origem: SyncOrigemSchema,
  qtdProdutos: z.number().int().nonnegative(),
  erroMensagem: z.string().nullable(),
  criadoEm: z.string().datetime(),
});

// Produto de um snapshot. Cópia imutável dos 19 campos confirmados na Affiliate API,
// com preços normalizados pra centavos. Veja [[shopee_affiliate_limits]].
export const ConcorrenteSnapshotProdutoSchema = z.object({
  id: z.string(),
  snapshotId: z.string(),
  itemId: BigIntString,
  productName: z.string(),
  priceMinCentavos: z.number().int().nonnegative(),
  priceMaxCentavos: z.number().int().nonnegative(),
  priceDiscountRate: z.number().int().min(0).max(100),
  sales: z.number().int().nonnegative(),
  commissionRate: DecimalString,
  commissionCentavos: z.number().int().nonnegative(),
  imageUrl: z.string(),
  productLink: z.string(),
  offerLink: z.string(),
  productCatIds: z.array(z.number().int()),
  shopType: z.array(z.number().int()),
  ratingStar: DecimalString.nullable(),
  periodStartTime: z.string().datetime(),
  periodEndTime: z.string().datetime(),
});

export type Concorrente = z.infer<typeof ConcorrenteSchema>;
export type ConcorrenteCreate = z.infer<typeof ConcorrenteCreateSchema>;
export type ConcorrenteCreateFromLink = z.infer<typeof ConcorrenteCreateFromLinkSchema>;
export type ConcorrenteLinkShopee = z.infer<typeof ConcorrenteLinkShopeeSchema>;
export type ConcorrenteUpdate = z.infer<typeof ConcorrenteUpdateSchema>;
export type PrecoConcorrente = z.infer<typeof PrecoConcorrenteSchema>;
export type PrecoConcorrenteCreate = z.infer<typeof PrecoConcorrenteCreateSchema>;
export type ConcorrenteSnapshot = z.infer<typeof ConcorrenteSnapshotSchema>;
export type ConcorrenteSnapshotProduto = z.infer<typeof ConcorrenteSnapshotProdutoSchema>;
