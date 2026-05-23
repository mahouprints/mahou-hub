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
  vendasReais: z.number().int().nonnegative().nullable(),
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

// ───── Dense product list (CSV-like) ─────
// Formato compacto pra consumo via MCP ou exports rápidos. Em vez de array de objetos,
// devolve headers + rows — economiza ~50% dos tokens vs JSON tradicional.
//
// Caso de uso: "me dá tudo que os concorrentes vendem entre R$ 20-50 com vendas mín 100".
// Consumer (Claude, scripts) consegue tratar como tabela diretamente.

export const ProdutosConcorrentesDenseQuerySchema = z.object({
  /** Limita a 1 loja específica (cuid). Omitir = todas as lojas. */
  concorrenteId: z.string().min(1).optional(),
  /** Filtra `sales` (afiliado, janela) mínimo. */
  vendasMin: z.coerce.number().int().nonnegative().optional(),
  /** Filtra preço mínimo em centavos. */
  precoMinCentavos: z.coerce.number().int().nonnegative().optional(),
  /** Filtra preço máximo em centavos. */
  precoMaxCentavos: z.coerce.number().int().nonnegative().optional(),
  /** Busca textual no productName (case+accent-insensitive). */
  q: z.string().min(1).max(200).optional(),
  /** Coluna pra ordenar. */
  sortBy: z.enum(['vendas', 'preco', 'rating', 'nome']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  /** Default 100, máximo 500 (acima disso estoura contexto Claude facilmente). */
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const ProdutosConcorrentesDenseResponseSchema = z.object({
  /** Nomes das colunas, na ordem em que aparecem em cada row. */
  headers: z.array(z.string()),
  /** Cada row = array de valores na ordem dos headers. */
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  /** Total de produtos que casam com os filtros (antes do limit). */
  total: z.number().int().nonnegative(),
  /** Quantos retornados (após o limit). */
  retornados: z.number().int().nonnegative(),
  /** Filtros efetivamente aplicados (eco pra debug). */
  filtros: z.record(z.unknown()),
  /** Nota pro consumer entender o que é. */
  nota: z.string(),
});

export type ProdutosConcorrentesDenseQuery = z.infer<typeof ProdutosConcorrentesDenseQuerySchema>;
export type ProdutosConcorrentesDenseResponse = z.infer<typeof ProdutosConcorrentesDenseResponseSchema>;

export type Concorrente = z.infer<typeof ConcorrenteSchema>;
export type ConcorrenteCreate = z.infer<typeof ConcorrenteCreateSchema>;
export type ConcorrenteCreateFromLink = z.infer<typeof ConcorrenteCreateFromLinkSchema>;
export type ConcorrenteLinkShopee = z.infer<typeof ConcorrenteLinkShopeeSchema>;
export type ConcorrenteUpdate = z.infer<typeof ConcorrenteUpdateSchema>;
export type PrecoConcorrente = z.infer<typeof PrecoConcorrenteSchema>;
export type PrecoConcorrenteCreate = z.infer<typeof PrecoConcorrenteCreateSchema>;
export type ConcorrenteSnapshot = z.infer<typeof ConcorrenteSnapshotSchema>;
export type ConcorrenteSnapshotProduto = z.infer<typeof ConcorrenteSnapshotProdutoSchema>;
