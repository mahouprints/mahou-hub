import { z } from 'zod';

const categoriaId = z.string().regex(/^MLB\d+$/, 'Informe uma categoria MLB válida.');
const dimensao = z.number().positive().max(1000);

export const MercadoLivrePublicacaoSchema = z.object({
  versao: z.literal(1),
  execucaoId: z.string().min(1),
  status: z.enum(['incompleto', 'concluido', 'indeterminado']),
  itens: z.array(
    z.object({
      chave: z.string().min(1),
      itemId: z.string().regex(/^MLB\d+$/),
      skus: z.array(z.string().min(1)),
      variationIds: z.record(z.string()).optional(),
      userProductId: z.string().optional(),
      familyId: z.string().optional(),
      permalink: z.string().url().optional(),
      descricaoConfirmada: z.boolean(),
      fiscalConfirmado: z.boolean(),
      verificado: z.boolean(),
    }),
  ),
  atualizadoEm: z.string().datetime(),
});

export const MercadoLivreConfiguracaoSchema = z.object({
  itemId: z
    .string()
    .regex(/^MLB\d+$/)
    .optional(),
  categoriaId,
  tipoAnuncio: z.enum(['gold_special', 'gold_pro']),
  modoEnvio: z.literal('me2'),
  tipoLogistica: z
    .string()
    .regex(/^[a-z_]+$/)
    .max(60),
  freteGratis: z.boolean(),
  condicao: z.enum(['new', 'used']),
  pesoGramas: z.number().int().positive().max(500000).nullable().optional(),
  alturaCm: dimensao.nullable().optional(),
  larguraCm: dimensao.nullable().optional(),
  comprimentoCm: dimensao.nullable().optional(),
  publicacao: MercadoLivrePublicacaoSchema.optional(),
});

export const MercadoLivreCotacaoInputSchema = MercadoLivreConfiguracaoSchema.omit({
  publicacao: true,
}).extend({
  precoCentavos: z.number().int().positive(),
  pesoGramas: z.number().int().positive().max(500000),
  alturaCm: dimensao,
  larguraCm: dimensao,
  comprimentoCm: dimensao,
});

export const MercadoLivreCotacaoSchema = z.object({
  contexto: MercadoLivreCotacaoInputSchema,
  categoriaNome: z.string(),
  tarifaCentavos: z.number().int().nonnegative(),
  freteCentavos: z.number().int().nonnegative().nullable(),
  tarifaFixaCentavos: z.number().int().nonnegative().nullable(),
  percentualTarifa: z.number().nonnegative().nullable(),
  cotadoEm: z.string().datetime(),
  pendencias: z.array(z.string()),
});

export type MercadoLivreConfiguracao = z.infer<typeof MercadoLivreConfiguracaoSchema>;
export type MercadoLivrePublicacao = z.infer<typeof MercadoLivrePublicacaoSchema>;
export type MercadoLivreCotacaoInput = z.infer<typeof MercadoLivreCotacaoInputSchema>;
export type MercadoLivreCotacao = z.infer<typeof MercadoLivreCotacaoSchema>;

/** Aceita a cotação por 24h somente para o mesmo preço e contexto. Ex.: custosMlDaCotacao(produto). */
export function custosMlDaCotacao(
  produto: { mercadoLivre?: unknown; cotacaoMl?: unknown; precoCentavos: number },
  agora = Date.now(),
): { tarifaCentavos: number; freteCentavos: number | null } | undefined {
  const cotacao = MercadoLivreCotacaoSchema.safeParse(produto.cotacaoMl);
  const contexto = MercadoLivreCotacaoInputSchema.safeParse({
    ...(typeof produto.mercadoLivre === 'object' ? produto.mercadoLivre : {}),
    precoCentavos: produto.precoCentavos,
  });
  if (!cotacao.success || !contexto.success) return undefined;
  const idade = agora - Date.parse(cotacao.data.cotadoEm);
  if (idade < 0 || idade > 24 * 60 * 60 * 1000) return undefined;
  if (JSON.stringify(contexto.data) !== JSON.stringify(cotacao.data.contexto)) return undefined;
  return { tarifaCentavos: cotacao.data.tarifaCentavos, freteCentavos: cotacao.data.freteCentavos };
}
