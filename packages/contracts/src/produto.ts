import { z } from 'zod';
import { CanalEnum, ImpressoraEnum } from './enums';
import { ProdutoInsumoInputSchema } from './insumo';

/**
 * Método planejado pra obter a foto final do produto:
 * - IA: gerar via skill /gerar-imagem (Nano Banana Pro). Default pra produtos
 *   caros/demorados de imprimir ou com geometria difícil de fotografar.
 * - FOTO: imprimir uma unidade física e fotografar. Default pra produtos
 *   baratos/rápidos onde o custo de produção é menor que o custo de iterar prompts.
 * - null/undefined: ainda não decidido.
 */
export const MetodoImagemEnum = z.enum(['IA', 'FOTO']);
export type MetodoImagem = z.infer<typeof MetodoImagemEnum>;

export const ProdutoSchema = z.object({
  id: z.string(),
  nome: z.string().min(1),
  inspiracao: z.string().nullable(),
  modelo3dUrl: z.string().url().nullable(),
  larguraCm: z.number().positive().nullable(),
  alturaCm: z.number().positive().nullable(),
  profundidadeCm: z.number().positive().nullable(),
  filamentoId: z.string(),
  // pesoG/tempoH precisam ser >0 num produto completo; rascunhos podem ter 0.
  pesoG: z.number().nonnegative(),
  tempoH: z.number().nonnegative(),
  impressora: ImpressoraEnum,
  embalagemCentavos: z.number().int().nonnegative(),
  precoCentavos: z.number().int().positive(),
  canalPrincipal: CanalEnum,
  ativo: z.boolean(),
  anunciado: z.boolean(),
  // Rascunho = produto incompleto (criado via virar-produto sem todos os campos).
  // Bloqueia o fluxo de anunciar até o usuário completar.
  rascunho: z.boolean(),
  metodoImagem: MetodoImagemEnum.nullable(),
});

export const ProdutoCreateSchema = ProdutoSchema.omit({
  id: true,
  ativo: true,
  anunciado: true,
  rascunho: true,
  metodoImagem: true,
}).extend({
  // No create normal (UI manual), peso e tempo voltam a ser obrigatórios positivos.
  pesoG: z.number().positive(),
  tempoH: z.number().positive(),
  ativo: z.boolean().default(true),
  anunciado: z.boolean().default(false),
  metodoImagem: MetodoImagemEnum.nullable().optional(),
  insumos: z.array(ProdutoInsumoInputSchema).optional(),
});

export const ProdutoUpdateSchema = ProdutoCreateSchema.partial();

export type Produto = z.infer<typeof ProdutoSchema>;
export type ProdutoCreate = z.infer<typeof ProdutoCreateSchema>;
export type ProdutoUpdate = z.infer<typeof ProdutoUpdateSchema>;

export const EstatisticasProdutoSchema = z.object({
  vendidos: z.number().int().nonnegative(),
  qtdVendas: z.number().int().nonnegative(),
  faturamentoCentavos: z.number().int().nonnegative(),
  ultimaVendaEm: z.coerce.date().nullable(),
  produzidos: z.number().int().nonnegative(),
  emProducao: z.number().int().nonnegative(),
});
export type EstatisticasProduto = z.infer<typeof EstatisticasProdutoSchema>;
