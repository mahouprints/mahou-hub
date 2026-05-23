import { z } from 'zod';

// Decimal vem da API como string pra preservar precisão (Postgres Decimal → JSON).
const DecimalString = z.string().regex(/^-?\d+(\.\d+)?$/);

export const OportunidadeMarketplaceSchema = z.enum(['SHOPEE', 'TIKTOK', 'ML', 'OUTRO']);
export type OportunidadeMarketplace = z.infer<typeof OportunidadeMarketplaceSchema>;

// IDEIA_GERADA = ideia autoral da Mahou inspirada em produtos do marketplace,
// não importação direta. externalId nesse caso é cuid local, não Shopee item.
export const OportunidadeFonteSchema = z.enum([
  'CONCORRENTE',
  'KEYWORD',
  'CATEGORIA',
  'TOP_VENDAS',
  'IDEIA_GERADA',
]);
export type OportunidadeFonte = z.infer<typeof OportunidadeFonteSchema>;

export const OportunidadeStatusSchema = z.enum([
  'NOVO',
  'EM_ANALISE',
  'APROVADO',
  'DESCARTADO',
  'VIRARAM_PRODUTO',
]);
export type OportunidadeStatus = z.infer<typeof OportunidadeStatusSchema>;

// Candidato retornado por /buscar e /explorar — não persistido, é só payload de descoberta.
export const OportunidadeCandidatoSchema = z.object({
  marketplace: OportunidadeMarketplaceSchema,
  externalId: z.string().min(1),
  productName: z.string(),
  priceMinCentavos: z.number().int().nonnegative(),
  priceMaxCentavos: z.number().int().nonnegative(),
  imageUrl: z.string(),
  productLink: z.string(),
  vendasAfiliadoMes: z.number().int().nonnegative(),
  ratingStar: z.number().min(0).max(5).nullable().optional(),
  categoriaIds: z.array(z.number().int()).default([]),
  lojaExternalId: z.string().nullable().optional(),
  lojaNome: z.string().nullable().optional(),
});
export type OportunidadeCandidato = z.infer<typeof OportunidadeCandidatoSchema>;

// Filtros usados por buscar e explorar.
const FiltrosSchema = z
  .object({
    precoMinCentavos: z.number().int().nonnegative().optional(),
    precoMaxCentavos: z.number().int().nonnegative().optional(),
    vendasMin: z.number().int().nonnegative().optional(),
    ratingMin: z.number().min(0).max(5).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .optional();

// POST /oportunidades/buscar — modo direcionado.
export const OportunidadeBuscarSchema = z.discriminatedUnion('tipo', [
  z.object({
    marketplace: OportunidadeMarketplaceSchema.default('SHOPEE'),
    tipo: z.literal('keyword'),
    params: z.object({ keyword: z.string().min(1) }),
    filtros: FiltrosSchema,
  }),
  z.object({
    marketplace: OportunidadeMarketplaceSchema.default('SHOPEE'),
    tipo: z.literal('categoria'),
    params: z.object({ categoryId: z.string().min(1) }),
    filtros: FiltrosSchema,
  }),
  z.object({
    marketplace: OportunidadeMarketplaceSchema.default('SHOPEE'),
    tipo: z.literal('concorrente'),
    // `concorrenteId` (interno) → lê snapshot local salvo pelo cron, sem custo de API.
    // `lojaExternalId` (shopId Shopee) → chama Affiliate API on-demand, sem persistir.
    //   Útil pra investigar uma loja descoberta numa busca antes de cadastrar.
    // Nenhum dos dois → agrega produtos de todas as lojas monitoradas (do snapshot).
    params: z
      .object({
        concorrenteId: z.string().min(1).optional(),
        lojaExternalId: z.string().min(1).optional(),
      })
      .default({}),
    filtros: FiltrosSchema,
  }),
]);
export type OportunidadeBuscar = z.infer<typeof OportunidadeBuscarSchema>;

// POST /oportunidades/explorar — modo brainstorm (top vendas sem filtro de nicho).
export const OportunidadeExplorarSchema = z.object({
  marketplace: OportunidadeMarketplaceSchema.default('SHOPEE'),
  filtros: FiltrosSchema,
});
export type OportunidadeExplorar = z.infer<typeof OportunidadeExplorarSchema>;

// POST /oportunidades — salva candidato no backlog (upsert por marketplace+externalId).
export const OportunidadeCreateSchema = OportunidadeCandidatoSchema.extend({
  fonte: OportunidadeFonteSchema,
  fonteParam: z.string().nullable().optional(),
  concorrenteId: z.string().nullable().optional(),
  snapshotProdutoId: z.string().nullable().optional(),
  status: OportunidadeStatusSchema.optional(),
  score: z.number().min(0).max(100).nullable().optional(),
  notas: z.string().nullable().optional(),
});
export type OportunidadeCreate = z.infer<typeof OportunidadeCreateSchema>;

// POST /oportunidades/bulk — Claude usa pra salvar batches.
export const OportunidadeBulkCreateSchema = z.object({
  itens: z.array(OportunidadeCreateSchema).min(1).max(200),
});
export type OportunidadeBulkCreate = z.infer<typeof OportunidadeBulkCreateSchema>;

// PATCH /oportunidades/:id — workflow updates.
export const OportunidadeUpdateSchema = z
  .object({
    status: OportunidadeStatusSchema.optional(),
    score: z.number().min(0).max(100).nullable().optional(),
    notas: z.string().nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'envie ao menos um campo (status, score ou notas)',
  });
export type OportunidadeUpdate = z.infer<typeof OportunidadeUpdateSchema>;

// POST /oportunidades/:id/virar-produto — completa o que o snapshot não tem.
// nome e precoCentavos têm default (do candidato); filamento/peso/tempo/impressora podem ficar
// de fora — se algum faltar, Produto é criado como `rascunho=true, ativo=false` com defaults
// zerados (primeiro filamento ativo, peso=0, tempo=0, impressora='A1'). Usuário completa depois.
export const OportunidadeVirarProdutoSchema = z.object({
  nome: z.string().min(1).optional(),
  precoCentavos: z.number().int().positive().optional(),
  filamentoId: z.string().min(1).optional(),
  pesoG: z.number().positive().optional(),
  tempoH: z.number().positive().optional(),
  impressora: z.enum(['A1', 'H2C']).optional(),
  embalagemCentavos: z.number().int().nonnegative().optional(),
});
export type OportunidadeVirarProduto = z.infer<typeof OportunidadeVirarProdutoSchema>;

// Resposta da API — record persistido.
export const OportunidadeSchema = z.object({
  id: z.string(),
  marketplace: OportunidadeMarketplaceSchema,
  externalId: z.string(),
  productName: z.string(),
  priceMinCentavos: z.number().int(),
  priceMaxCentavos: z.number().int(),
  imageUrl: z.string(),
  productLink: z.string(),
  vendasAfiliadoMes: z.number().int(),
  ratingStar: DecimalString.nullable(),
  categoriaIds: z.array(z.number().int()),
  lojaExternalId: z.string().nullable(),
  lojaNome: z.string().nullable(),
  fonte: OportunidadeFonteSchema,
  fonteParam: z.string().nullable(),
  concorrenteId: z.string().nullable(),
  snapshotProdutoId: z.string().nullable(),
  status: OportunidadeStatusSchema,
  score: DecimalString.nullable(),
  notas: z.string().nullable(),
  produtoId: z.string().nullable(),
  criadoEm: z.string().datetime(),
  atualizadoEm: z.string().datetime(),
});
export type Oportunidade = z.infer<typeof OportunidadeSchema>;

export const OportunidadeEstatisticasSchema = z.object({
  total: z.number().int().nonnegative(),
  porStatus: z.record(OportunidadeStatusSchema, z.number().int().nonnegative()),
  porFonte: z.record(OportunidadeFonteSchema, z.number().int().nonnegative()),
  porMarketplace: z.record(OportunidadeMarketplaceSchema, z.number().int().nonnegative()),
});
export type OportunidadeEstatisticas = z.infer<typeof OportunidadeEstatisticasSchema>;
