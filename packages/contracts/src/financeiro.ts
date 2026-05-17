import { z } from 'zod';

export const ResumoFinanceiroSchema = z.object({
  mes: z.string(), // 'YYYY-MM'
  faturamentoCentavos: z.number().int(),
  custosVariaveisCentavos: z.number().int(), // soma de custo produção + embalagem dos produtos vendidos
  custosGeraisCentavos: z.number().int(), // soma dos Custo do mês
  impostosCentavos: z.number().int(),
  taxasMarketplaceCentavos: z.number().int(),
  lucroLiquidoCentavos: z.number().int(),
  margem: z.number(), // 0..1
  porCanal: z.object({
    SHOPEE: z.number().int(),
    ML: z.number().int(),
    SITE: z.number().int(),
  }),
  qtdVendas: z.number().int().nonnegative(),
  qtdItensVendidos: z.number().int().nonnegative(),
});

export type ResumoFinanceiro = z.infer<typeof ResumoFinanceiroSchema>;
