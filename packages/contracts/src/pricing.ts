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

export type CalcularInput = z.infer<typeof CalcularInputSchema>;
export type CalcularOutput = z.infer<typeof CalcularOutputSchema>;
export type SimularInput = z.infer<typeof SimularInputSchema>;
export type SimularOutput = z.infer<typeof SimularOutputSchema>;
