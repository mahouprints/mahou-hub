import { z } from 'zod';
import { VendedorShopeeEnum } from './enums';

export const ParametroSchema = z.object({
  id: z.literal(1).default(1),
  tarifaKwhCentavos: z.number().int().nonnegative(),
  vendedorShopee: VendedorShopeeEnum,
  emCampanhaShopee: z.boolean(),
  adicionalCampanhaPct: z.number().nonnegative(),
  comissaoMlPct: z.number().nonnegative(),
  impostoAtivo: z.boolean(),
  impostoPct: z.number().nonnegative(),
  // Taxas do TikTok Shop são percentuais constantes (sem faixa por preço).
  tiktokComissaoPlataformaPct: z.number().nonnegative().default(6),
  tiktokTaxaSfpPct: z.number().nonnegative().default(6),
  tiktokComissaoAfiliadoPct: z.number().nonnegative().default(30),
  tiktokTaxaPagamentoPct: z.number().nonnegative().default(3),
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

export const FaixaShopeeCreateSchema = FaixaShopeeSchema.omit({ id: true });
export const FaixaShopeeUpdateSchema = FaixaShopeeCreateSchema.partial();

export const FaixaMercadoLivreSchema = z.object({
  id: z.string(),
  faixa: z.enum(['A', 'B', 'C', 'D', 'E']),
  limInferiorCentavos: z.number().int().nonnegative(),
  custoFixoCentavos: z.number().int().nonnegative(),
  pctAlternativo: z.number().nonnegative(),
  comissaoCategoriaPct: z.number().nonnegative(),
});

export const FaixaMercadoLivreCreateSchema = FaixaMercadoLivreSchema.omit({ id: true });
export const FaixaMercadoLivreUpdateSchema = FaixaMercadoLivreCreateSchema.partial();

export type Parametro = z.infer<typeof ParametroSchema>;
export type ParametroUpdate = z.infer<typeof ParametroUpdateSchema>;
export type FaixaShopee = z.infer<typeof FaixaShopeeSchema>;
export type FaixaShopeeCreate = z.infer<typeof FaixaShopeeCreateSchema>;
export type FaixaShopeeUpdate = z.infer<typeof FaixaShopeeUpdateSchema>;
export type FaixaMercadoLivre = z.infer<typeof FaixaMercadoLivreSchema>;
export type FaixaMercadoLivreCreate = z.infer<typeof FaixaMercadoLivreCreateSchema>;
export type FaixaMercadoLivreUpdate = z.infer<typeof FaixaMercadoLivreUpdateSchema>;
