import { z } from 'zod';

export const ResumoFinanceiroSchema = z.object({
  mes: z.string(), // 'YYYY-MM'
  faturamentoCentavos: z.number().int(),
  custosVariaveisCentavos: z.number().int(), // filamento + energia + embalagem dos produtos vendidos (sem insumos)
  custosInsumosCentavos: z.number().int(), // consumo de insumos cadastrados nas vendas do período
  custosGeraisCentavos: z.number().int(), // soma dos Custo lançados manualmente no mês
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
