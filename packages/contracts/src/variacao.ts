import { z } from 'zod';

/**
 * Variação vendável de um Produto (ex.: cor). Tem SKU próprio e carrega o estoque
 * de peças prontas. `estoqueAtual` é somente-leitura aqui — só muda via movimento
 * de estoque (ver estoque.ts), pra manter o histórico como fonte da verdade.
 */
export const ProdutoVariacaoSchema = z.object({
  id: z.string(),
  produtoId: z.string(),
  nome: z.string().min(1),
  sku: z.string().min(1),
  // Overrides opcionais — quando null, herda do Produto.
  filamentoId: z.string().nullable(),
  precoCentavos: z.number().int().nonnegative().nullable(),
  estoqueAtual: z.number().int(),
  estoqueMinimo: z.number().int().nonnegative(),
  ativo: z.boolean(),
});

export const ProdutoVariacaoCreateSchema = z.object({
  produtoId: z.string(),
  nome: z.string().min(1),
  sku: z.string().min(1),
  filamentoId: z.string().nullable().optional(),
  precoCentavos: z.number().int().nonnegative().nullable().optional(),
  estoqueMinimo: z.number().int().nonnegative().optional(),
});

export const ProdutoVariacaoUpdateSchema = ProdutoVariacaoCreateSchema.omit({
  produtoId: true,
})
  .partial()
  .extend({ ativo: z.boolean().optional() });

export type ProdutoVariacao = z.infer<typeof ProdutoVariacaoSchema>;
export type ProdutoVariacaoCreate = z.infer<typeof ProdutoVariacaoCreateSchema>;
export type ProdutoVariacaoUpdate = z.infer<typeof ProdutoVariacaoUpdateSchema>;
