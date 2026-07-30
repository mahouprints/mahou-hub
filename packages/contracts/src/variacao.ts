import { z } from 'zod';

/**
 * Teto de caracteres do SKU. Shopee e Mercado Livre aceitam bem mais (100), mas quem
 * aperta aqui é a etiqueta da embalagem e a planilha de importação, que truncam calado.
 */
export const SKU_MAX = 24;

/** Só o que os dois marketplaces aceitam sem transformar: maiúscula, número e hífen. */
export const SKU_FORMATO = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

const SkuSchema = z
  .string()
  .min(1)
  .max(SKU_MAX, `SKU passa de ${SKU_MAX} caracteres`)
  .regex(SKU_FORMATO, 'SKU aceita só letras maiúsculas, números e hífen (ex: SUPORTE-MOBILE-AZ)');

/**
 * Variação vendável de um Produto (ex.: cor). Tem SKU próprio e carrega o estoque
 * de peças prontas. `estoqueAtual` é somente-leitura aqui — só muda via movimento
 * de estoque (ver estoque.ts), pra manter o histórico como fonte da verdade.
 */
export const ProdutoVariacaoSchema = z.object({
  id: z.string(),
  produtoId: z.string(),
  nome: z.string().min(1),
  sku: SkuSchema,
  // Overrides opcionais — quando null, herda do Produto.
  filamentoId: z.string().nullable(),
  precoCentavos: z.number().int().nonnegative().nullable(),
  /// Peso e tempo próprios: usados pela variação que muda o que sai da impressora
  /// (kit, tamanho). Null = herda do produto, que é o caso de toda variação de cor.
  pesoG: z.number().positive().nullable(),
  tempoH: z.number().positive().nullable(),
  estoqueAtual: z.number().int(),
  estoqueMinimo: z.number().int().nonnegative(),
  ativo: z.boolean(),
});

export const ProdutoVariacaoCreateSchema = z.object({
  produtoId: z.string(),
  nome: z.string().min(1),
  // Opcional: sem SKU, o backend gera a partir do nome do produto + sigla da cor.
  // Quem digita à mão passa pela mesma regra de formato.
  sku: SkuSchema.optional(),
  filamentoId: z.string().nullable().optional(),
  precoCentavos: z.number().int().nonnegative().nullable().optional(),
  pesoG: z.number().positive().nullable().optional(),
  tempoH: z.number().positive().nullable().optional(),
  estoqueMinimo: z.number().int().nonnegative().optional(),
});

export const ProdutoVariacaoUpdateSchema = ProdutoVariacaoCreateSchema.omit({
  produtoId: true,
})
  .partial()
  .extend({ ativo: z.boolean().optional() });

/**
 * Cria a combinação produto × cor de uma vez. Cadastrar 49 produtos em 4 cores pelo
 * diálogo são 196 aberturas — o que na prática significa que ninguém cadastra.
 */
export const VariacoesEmLoteSchema = z.object({
  produtoIds: z.array(z.string()).min(1, 'Escolha pelo menos um produto'),
  filamentoIds: z.array(z.string()).min(1, 'Escolha pelo menos uma cor'),
});

export const VariacoesEmLoteResultadoSchema = z.object({
  criadas: z.number().int(),
  /** Combinação que já existia. Repetir o lote não duplica nada. */
  puladas: z.number().int(),
  novas: z.array(z.object({ produto: z.string(), cor: z.string(), sku: z.string() })),
});

export type ProdutoVariacao = z.infer<typeof ProdutoVariacaoSchema>;
export type ProdutoVariacaoCreate = z.infer<typeof ProdutoVariacaoCreateSchema>;
export type ProdutoVariacaoUpdate = z.infer<typeof ProdutoVariacaoUpdateSchema>;
export type VariacoesEmLote = z.infer<typeof VariacoesEmLoteSchema>;
export type VariacoesEmLoteResultado = z.infer<typeof VariacoesEmLoteResultadoSchema>;
