import { z } from 'zod';
import { OportunidadeMarketplaceSchema } from './oportunidade';

// Classificação automática do gap analysis pra um produto de concorrente vs catálogo Mahou.
// - GAP: Mahou não tem nada similar.
// - VARIACAO: Mahou tem algo no espírito mas com forma/tema diferente (oportunidade de variação).
// - MATCH: Mahou já cobre (algoritmo decidiu) — não bloqueia.
// - MATCH_MANUAL: usuário marcou explicitamente que Mahou já tem similar (filtra).
// - DESCARTADO: usuário marcou explicitamente como não-relevante (material/categoria incompatível).
export const GapClassificacaoSchema = z.enum([
  'GAP',
  'VARIACAO',
  'MATCH',
  'MATCH_MANUAL',
  'DESCARTADO',
]);
export type GapClassificacao = z.infer<typeof GapClassificacaoSchema>;

// Decisão manual persistida via UI.
export const GapDecisaoSchema = z.enum(['MATCH_MANUAL', 'DESCARTADO']);
export type GapDecisao = z.infer<typeof GapDecisaoSchema>;

// Linha da tabela /oportunidades/gaps — produto de concorrente classificado vs Mahou.
export const GapItemSchema = z.object({
  marketplace: OportunidadeMarketplaceSchema,
  externalId: z.string(),
  productName: z.string(),
  priceMinCentavos: z.number().int(),
  priceMaxCentavos: z.number().int(),
  imageUrl: z.string(),
  productLink: z.string(),
  vendasAfiliadoMes: z.number().int(),
  ratingStar: z.number().nullable(),
  categoriaIds: z.array(z.number().int()),
  lojaExternalId: z.string().nullable(),
  lojaNome: z.string().nullable(),
  classificacao: GapClassificacaoSchema,
  // Produto Mahou similar quando classificacao=MATCH ou MATCH_MANUAL (rastreabilidade).
  produtoMahouSimilar: z
    .object({
      id: z.string(),
      nome: z.string(),
    })
    .nullable(),
  // Decisão manual persistida se houver.
  decisao: z
    .object({
      tipo: GapDecisaoSchema,
      observacao: z.string().nullable(),
      decididoPor: z.string().nullable(),
      decididoEm: z.string().datetime(),
    })
    .nullable(),
});
export type GapItem = z.infer<typeof GapItemSchema>;

// GET /oportunidades/gaps
export const GapsQuerySchema = z.object({
  classificacao: GapClassificacaoSchema.optional(),
  lojaExternalId: z.string().optional(),
  categoriaId: z.coerce.number().int().optional(),
  vendasMin: z.coerce.number().int().nonnegative().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});
export type GapsQuery = z.infer<typeof GapsQuerySchema>;

// POST /oportunidades/gaps/:marketplace/:externalId/decisao
export const GapDecidirSchema = z.object({
  decisao: GapDecisaoSchema,
  produtoId: z.string().min(1).nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
});
export type GapDecidir = z.infer<typeof GapDecidirSchema>;

// POST /oportunidades/gaps/:marketplace/:externalId/copiar-rascunho
// Cria um Produto rascunho a partir do produto Shopee. Mahou completa peso/tempo depois.
export const GapCopiarRascunhoSchema = z.object({
  filamentoId: z.string().min(1),
  canalPrincipal: z.enum(['SHOPEE', 'ML', 'SITE', 'TIKTOK']).optional(),
});
export type GapCopiarRascunho = z.infer<typeof GapCopiarRascunhoSchema>;

// GET /oportunidades/categorias-emergentes
// Identifica categorias Shopee com freq alta nos GAPs detectados que NÃO estão na lista curada.
export const CategoriaEmergenteSchema = z.object({
  categoriaId: z.number().int(),
  freq: z.number().int(),
  exemplos: z.array(z.string()).max(3),
});
export type CategoriaEmergente = z.infer<typeof CategoriaEmergenteSchema>;
