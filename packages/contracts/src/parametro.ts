import { z } from 'zod';
import { VendedorShopeeEnum } from './enums.js';

export const ParametroSchema = z.object({
  id: z.literal(1).default(1),
  tarifaKwhCentavos: z.number().int().nonnegative(),
  vendedorShopee: VendedorShopeeEnum,
  emCampanhaShopee: z.boolean(),
  adicionalCampanhaPct: z.number().nonnegative(),
  comissaoMlPct: z.number().nonnegative(),
  impostoAtivo: z.boolean(),
  impostoPct: z.number().nonnegative(),
  margemThresholdVerde: z.number().min(0).max(1).default(0.3),
  margemThresholdAmarelo: z.number().min(0).max(1).default(0.15),
});

export const ParametroUpdateSchema = ParametroSchema.partial({ id: true });

export const FaixaShopeeSchema = z.object({
  id: z.string(),
  limInferiorCentavos: z.number().int().nonnegative(),
  comissaoPct: z.number().nonnegative(),
  fixaCnpjCentavos: z.number().int().nonnegative(),
  fixaCpfBaixoCentavos: z.number().int().nonnegative(),
  fixaCpfAltoCentavos: z.number().int().nonnegative(),
});

export const FaixaMercadoLivreSchema = z.object({
  id: z.string(),
  faixa: z.enum(['A', 'B', 'C', 'D', 'E']),
  limInferiorCentavos: z.number().int().nonnegative(),
  custoFixoCentavos: z.number().int().nonnegative(),
  pctAlternativo: z.number().nonnegative(),
  comissaoCategoriaPct: z.number().nonnegative(),
});

export type Parametro = z.infer<typeof ParametroSchema>;
export type ParametroUpdate = z.infer<typeof ParametroUpdateSchema>;
export type FaixaShopee = z.infer<typeof FaixaShopeeSchema>;
export type FaixaMercadoLivre = z.infer<typeof FaixaMercadoLivreSchema>;
