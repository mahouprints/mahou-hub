import { z } from 'zod';
import { ImpressoraEnum } from './enums';

/**
 * Input da Calculadora (`POST /pricing/calcular`) — stateless, recebe ID de filamento
 * ou potências cruas, mais peso/tempo/preço. Não persiste nada.
 */
export const CalcularInputSchema = z.object({
  filamentoId: z.string().optional(),
  filamentoCustoKgCentavos: z.number().int().nonnegative().optional(),
  filamentoPotenciaA1W: z.number().int().nonnegative().optional(),
  filamentoPotenciaH2cW: z.number().int().nonnegative().optional(),
  pesoG: z.number().positive(),
  tempoH: z.number().positive(),
  impressora: ImpressoraEnum,
  embalagemCentavos: z.number().int().nonnegative(),
  custoInsumosCentavos: z.number().int().nonnegative().optional(),
  precoCentavos: z.number().int().positive(),
});

export const CalcularOutputSchema = z.object({
  custoFilamentoCentavos: z.number().int(),
  custoEnergiaCentavos: z.number().int(),
  custoTotalProducaoCentavos: z.number().int(),
  impostoCentavos: z.number().int(),
  taxaShopeeCentavos: z.number().int(),
  taxaMlCentavos: z.number().int(),
  taxaTikTokCentavos: z.number().int(),
  liquidoShopeeCentavos: z.number().int(),
  liquidoMlCentavos: z.number().int(),
  liquidoSiteCentavos: z.number().int(),
  liquidoTikTokCentavos: z.number().int(),
  margemShopee: z.number(),
  margemMl: z.number(),
  margemSite: z.number(),
  margemTikTok: z.number(),
  lucroPorHoraShopeeCentavos: z.number().int(),
  lucroPorHoraMlCentavos: z.number().int(),
  lucroPorHoraSiteCentavos: z.number().int(),
  lucroPorHoraTikTokCentavos: z.number().int(),
});

export const SimularInputSchema = z.object({
  produtoId: z.string(),
  horasPorDia: z.number().positive(),
  dias: z.number().int().positive(),
  utilizacaoPct: z.number().min(0).max(100),
  numeroImpressoras: z.number().int().positive(),
});

export const SimularOutputSchema = z.object({
  horasTotais: z.number(),
  capacidadeUnidades: z.number().int(),
  faturamentoCentavos: z.number().int(),
  lucroLiquidoCentavos: z.number().int(),
  margem: z.number(),
});

/**
 * Plano de anúncios (Shopee Ads): cenários Teste + Escalonamento. Stateless.
 * Consome a economia já calculada (precoCentavos + líquido do canal escolhido) e os
 * parâmetros de anúncio. `params` parcial sobrescreve os defaults globais do Parametro.
 */
export const NivelConfiancaEnum = z.union([z.literal(95), z.literal(99)]);

export const PlanoAdsParamsSchema = z.object({
  cpcMedioCentavos: z.number().int().positive(),
  taxaRetornoPct: z.number().min(0).max(100),
  janelaTesteDias: z.number().int().min(1),
  nivelConfianca: NivelConfiancaEnum,
  fatorMargemEscala: z.number().min(1),
  passoIncrementoPct: z.number().min(0),
  cadenciaIncrementoDias: z.number().int().min(1),
  nDegraus: z.number().int().min(1).max(20),
  budgetDiarioMinimoCentavos: z.number().int().positive().nullable().optional(),
  tetoBudgetDiarioCentavos: z.number().int().positive().nullable().optional(),
});

export const PlanoAdsInputSchema = z.object({
  precoCentavos: z.number().int().positive(),
  // margem de contribuição por venda (líquido do canal). Pode ser <= 0 → resposta "inviável".
  margemContribuicaoCentavos: z.number().int(),
  params: PlanoAdsParamsSchema.partial().optional(),
});

export const DegrauEscalaSchema = z.object({
  degrau: z.number().int(),
  diaInicio: z.number().int(),
  diaFim: z.number().int(),
  budgetDiarioCentavos: z.number().int(),
});

export const PlanoAdsOutputSchema = z.object({
  inviavel: z.boolean(),
  avisoInviavel: z.string().nullable(),
  mcLiquidaPct: z.number(),
  roasBreakeven: z.number(),
  roasAlvoTeste: z.number(),
  roasAlvoEscala: z.number(),
  cpaAlvoCentavos: z.number().int(),
  vendasEsperadas: z.number().int(),
  orcamentoTesteTotalCentavos: z.number().int(),
  investimentoDiarioTesteCentavos: z.number().int(),
  cliquesEstimadosTeste: z.number().int(),
  investimentoDiarioEscalaInicialCentavos: z.number().int(),
  escada: z.array(DegrauEscalaSchema),
  avisos: z.array(z.string()),
});

export type CalcularInput = z.infer<typeof CalcularInputSchema>;
export type CalcularOutput = z.infer<typeof CalcularOutputSchema>;
export type SimularInput = z.infer<typeof SimularInputSchema>;
export type SimularOutput = z.infer<typeof SimularOutputSchema>;
export type PlanoAdsParams = z.infer<typeof PlanoAdsParamsSchema>;
export type PlanoAdsInput = z.infer<typeof PlanoAdsInputSchema>;
export type PlanoAdsOutput = z.infer<typeof PlanoAdsOutputSchema>;
