import { z } from 'zod';

// Decimal vem da API como string pra preservar precisão (Postgres Decimal → JSON).
const DecimalString = z.string().regex(/^-?\d+(\.\d+)?$/);

export const ModeloMakerWorldStatusSchema = z.enum([
  'NOVO',
  'FAVORITO',
  'DESCARTADO',
  'VIROU_PRODUTO',
]);
export type ModeloMakerWorldStatus = z.infer<typeof ModeloMakerWorldStatusSchema>;

// Veredicto de licença. Só LIVRE/ATRIBUICAO/SEM_DERIVADAS podem virar produto —
// o bot já filtra antes de enviar, mas o enum aceita PROIBIDA pra permitir
// reclassificação se o MakerWorld mudar a licença de um modelo já importado.
export const LicencaVeredictoSchema = z.enum([
  'LIVRE',
  'ATRIBUICAO',
  'SEM_DERIVADAS',
  'PROIBIDA',
]);
export type LicencaVeredicto = z.infer<typeof LicencaVeredictoSchema>;

export const VeredictoIaSchema = z.enum(['APROVADO', 'TALVEZ', 'REPROVADO']);
export type VeredictoIa = z.infer<typeof VeredictoIaSchema>;

export const NichoSchema = z.enum([
  'FLEXI_ARTICULADO',
  'ORGANIZACAO_SETUP',
  'DECOR_CASA',
  'FIDGET_ANTISTRESS',
  'DATAS_FESTIVAS',
  'PERSONALIZAVEL',
  'PET',
  'ACESSORIOS_MODA',
  'GADGET_ELETRONICO',
  'MINIATURA_TABLETOP',
  'PROPS_COSPLAY',
  'BRINQUEDO_INFANTIL',
  'NENHUM',
]);
export type Nicho = z.infer<typeof NichoSchema>;

// Um modelo como o bot `scripts/makerworld` envia. Todos os números já vêm calculados —
// o Hub não refaz a conta na importação (só quando o modelo virar Produto de verdade).
export const MakerworldModeloImportSchema = z.object({
  externalId: z.string().min(1),
  titulo: z.string().min(1),
  url: z.string().url(),
  autor: z.string().default(''),
  imagemUrl: z.string(),
  downloads: z.number().int().nonnegative().default(0),
  curtidas: z.number().int().nonnegative().default(0),
  colecoes: z.number().int().nonnegative().default(0),
  licenca: z.string().min(1),
  licencaVeredicto: LicencaVeredictoSchema,
  licencaObrigacao: z.string().default(''),
  nicho: NichoSchema,
  // Peso e tempo são DO ANÚNCIO (peça × unidadesPorKit). Peça abaixo de 18g não se
  // sustenta sozinha na Shopee (taxa fixa + frete), então é precificada como kit.
  pesoGramas: z.number().nonnegative(),
  tempoHoras: z.number().nonnegative(),
  unidadesPorKit: z.number().int().min(1).max(12).default(1),
  custoEstimadoCentavos: z.number().int().nonnegative(),
  precoSugeridoCentavos: z.number().int().nonnegative(),
  margemEstimadaPct: z.number(),
  lucroPorHoraCentavos: z.number().int(),
  scoreObjetivo: z.number().int().min(0).max(100),
  notaIa: z.number().int().min(0).max(100),
  veredictoIa: VeredictoIaSchema,
  justificativaIa: z.string().default(''),
  alertas: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  temFotoReal: z.boolean().default(false),
});
export type MakerworldModeloImport = z.infer<typeof MakerworldModeloImportSchema>;

// Limite de 200 por chamada: o upsert roda em transação única e um payload maior
// estoura o body limit do Nest antes de chegar no Prisma.
export const MakerworldBulkImportSchema = z.object({
  modelos: z.array(MakerworldModeloImportSchema).min(1).max(200),
});
export type MakerworldBulkImport = z.infer<typeof MakerworldBulkImportSchema>;

export const MakerworldListarSchema = z.object({
  status: ModeloMakerWorldStatusSchema.optional(),
  nicho: NichoSchema.optional(),
  veredictoIa: VeredictoIaSchema.optional(),
  notaMinima: z.coerce.number().int().min(0).max(100).optional(),
  lucroPorHoraMinimoCentavos: z.coerce.number().int().optional(),
  /// Esconde modelos com qualquer alerta na lista (ex.: IP_TERCEIRO).
  /// `?semAlertas=X` sozinho chega como string e `?semAlertas=X&semAlertas=Y` como array —
  /// o preprocess normaliza os dois pra array antes da validação.
  semAlertas: z
    .preprocess((v) => (typeof v === 'string' ? [v] : v), z.array(z.string()))
    .optional(),
  q: z.string().optional(),
  ordenarPor: z.enum(['notaIa', 'scoreObjetivo', 'lucroPorHora', 'downloads']).default('notaIa'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type MakerworldListar = z.infer<typeof MakerworldListarSchema>;

export const MakerworldUpdateSchema = z.object({
  status: ModeloMakerWorldStatusSchema.optional(),
  observacao: z.string().max(2000).nullable().optional(),
  nicho: NichoSchema.optional(),
});
export type MakerworldUpdate = z.infer<typeof MakerworldUpdateSchema>;

export const MakerworldBulkStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  status: ModeloMakerWorldStatusSchema,
});
export type MakerworldBulkStatus = z.infer<typeof MakerworldBulkStatusSchema>;

export const ModeloMakerWorldSchema = MakerworldModeloImportSchema.extend({
  id: z.string(),
  pesoGramas: DecimalString,
  tempoHoras: DecimalString,
  margemEstimadaPct: DecimalString,
  status: ModeloMakerWorldStatusSchema,
  observacao: z.string().nullable(),
  produtoId: z.string().nullable(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type ModeloMakerWorld = z.infer<typeof ModeloMakerWorldSchema>;

// Marketplaces que a skill `gerar-descricao` sabe escrever. SITE fica de fora de
// propósito: anúncio existe pra ranquear em algoritmo de marketplace, e a loja
// própria não tem um.
export const AnuncioMarketplaceSchema = z.enum(['SHOPEE', 'ML', 'TIKTOK']);
export type AnuncioMarketplace = z.infer<typeof AnuncioMarketplaceSchema>;

// Copy gerada FORA do Hub (o backend não fala com LLM) e gravada aqui por quem rodou
// a skill. O teto de 200 no título é o do TikTok, o mais largo dos três: validar pelo
// limite do ML (60) faria o Hub rejeitar título de TikTok perfeitamente válido. Quem
// respeita o limite de cada marketplace é a skill.
export const AnuncioModeloUpsertSchema = z.object({
  marketplace: AnuncioMarketplaceSchema,
  titulo: z.string().min(1).max(200),
  descricao: z.string().min(1).max(20000),
  tags: z.array(z.string().min(1)).max(50).default([]),
  // Caminho completo na taxonomia do marketplace, ex.: "Casa e Decoração > Cozinha
  // > Utensílios". Cada um tem a sua, e o ML penaliza categoria genérica.
  categoria: z.string().max(300).nullable().default(null),
  // ID da categoria no marketplace (ex.: MLB433037). Vem da API do marketplace —
  // nunca escrito à mão, porque caminho plausível não é caminho existente.
  categoriaId: z.string().max(40).nullable().default(null),
  // Atributos da ficha técnica. Na prática só o ML usa — lá é SEO crítico preencher
  // tudo; Shopee e TikTok não têm campo equivalente.
  fichaTecnica: z
    .array(z.object({ chave: z.string().min(1).max(80), valor: z.string().min(1).max(300) }))
    .max(40)
    .default([]),
  precoBaseCentavos: z.number().int().positive(),
});
export type AnuncioModeloUpsert = z.infer<typeof AnuncioModeloUpsertSchema>;

export const AnuncioModeloSchema = AnuncioModeloUpsertSchema.extend({
  id: z.string(),
  modeloId: z.string(),
  versao: z.number().int(),
  geradoEm: z.string(),
  atualizadoEm: z.string(),
});
export type AnuncioModelo = z.infer<typeof AnuncioModeloSchema>;

// Economia recalculada na hora a partir do preço e do custo guardados no modelo.
// Não é persistida: taxa de marketplace e imposto mudam no Parametro, e número
// congelado no banco viraria mentira silenciosa na tela.
export const EconomiaModeloSchema = z.object({
  canal: AnuncioMarketplaceSchema,
  precoCentavos: z.number().int(),
  custoCentavos: z.number().int(),
  taxaMarketplaceCentavos: z.number().int(),
  impostoCentavos: z.number().int(),
  liquidoCentavos: z.number().int(),
  margemPct: z.number(),
  lucroPorHoraCentavos: z.number().int(),
});
export type EconomiaModelo = z.infer<typeof EconomiaModeloSchema>;
