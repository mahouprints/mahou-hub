import { z } from 'zod';
import { CanalEnum } from './enums';
import { CategoriaCustoEnum } from './custo';
import { ResumoFinanceiroSchema } from './financeiro';

/** Dia civil sem conversão de fuso; ex.: 2028-02-29. */
export const DataRelatorioSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((valor) => {
    const instante = new Date(`${valor}T00:00:00.000Z`);
    return (
      !valor.startsWith('0000') &&
      Number.isFinite(instante.getTime()) &&
      instante.toISOString().slice(0, 10) === valor
    );
  }, 'Informe uma data existente no formato YYYY-MM-DD');

export const PeriodoRelatorioEnum = z.enum(['DIARIO', 'SEMANAL', 'MENSAL', 'ANUAL']);
export const RelatorioFinanceiroQuerySchema = z.object({
  periodo: PeriodoRelatorioEnum,
  referencia: DataRelatorioSchema,
});

export const TotaisFinanceirosSchema = ResumoFinanceiroSchema.omit({
  mes: true,
  porCanal: true,
}).extend({
  gastosTotaisCentavos: z.number().int(),
});
export const ResumoRelatorioFinanceiroSchema = TotaisFinanceirosSchema.extend({
  porCanal: ResumoFinanceiroSchema.shape.porCanal,
});

// Custos gerais não são rateados por produto/canal sem uma regra de negócio explícita.
export const TotaisVendasRelatorioSchema = z.object({
  faturamentoCentavos: z.number().int(),
  custosVariaveisCentavos: z.number().int(),
  custosInsumosCentavos: z.number().int(),
  impostosCentavos: z.number().int(),
  taxasMarketplaceCentavos: z.number().int(),
  lucroContribuicaoCentavos: z.number().int(),
  qtdVendas: z.number().int().nonnegative(),
  qtdItensVendidos: z.number().int().nonnegative(),
});

export const VendaRelatorioSchema = TotaisVendasRelatorioSchema.omit({
  qtdVendas: true,
  qtdItensVendidos: true,
}).extend({
  id: z.string(),
  produtoId: z.string(),
  produtoNome: z.string(),
  canal: CanalEnum,
  qtd: z.number().int().positive(),
  precoUnitarioCentavos: z.number().int().positive(),
  dataVenda: DataRelatorioSchema,
  observacao: z.string().nullable(),
});

export const CustoRelatorioSchema = z.object({
  id: z.string(),
  descricao: z.string(),
  categoria: CategoriaCustoEnum,
  valorCentavos: z.number().int(),
  dataCompetencia: DataRelatorioSchema,
  observacao: z.string().nullable(),
});

export const PontoSerieFinanceiraSchema = TotaisFinanceirosSchema.extend({
  inicio: DataRelatorioSchema,
  fim: DataRelatorioSchema,
  rotulo: z.string(),
});

export const RelatorioFinanceiroSchema = RelatorioFinanceiroQuerySchema.extend({
  inicio: DataRelatorioSchema,
  fim: DataRelatorioSchema,
  titulo: z.string(),
  resumo: ResumoRelatorioFinanceiroSchema,
  serie: z.array(PontoSerieFinanceiraSchema),
  vendas: z.array(VendaRelatorioSchema),
  custosGerais: z.array(CustoRelatorioSchema),
  porCategoria: z.array(
    z.object({
      categoria: CategoriaCustoEnum,
      valorCentavos: z.number().int(),
      qtdLancamentos: z.number().int().nonnegative(),
    }),
  ),
  porCanal: z.array(TotaisVendasRelatorioSchema.extend({ canal: CanalEnum })),
  porProduto: z.array(
    TotaisVendasRelatorioSchema.extend({ produtoId: z.string(), produtoNome: z.string() }),
  ),
});

export type PeriodoRelatorio = z.infer<typeof PeriodoRelatorioEnum>;
export type RelatorioFinanceiroQuery = z.infer<typeof RelatorioFinanceiroQuerySchema>;
export type TotaisFinanceiros = z.infer<typeof TotaisFinanceirosSchema>;
export type TotaisVendasRelatorio = z.infer<typeof TotaisVendasRelatorioSchema>;
export type ResumoRelatorioFinanceiro = z.infer<typeof ResumoRelatorioFinanceiroSchema>;
export type VendaRelatorio = z.infer<typeof VendaRelatorioSchema>;
export type CustoRelatorio = z.infer<typeof CustoRelatorioSchema>;
export type PontoSerieFinanceira = z.infer<typeof PontoSerieFinanceiraSchema>;
export type RelatorioFinanceiro = z.infer<typeof RelatorioFinanceiroSchema>;
