import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type FaixaMercadoLivre as FaixaMlPricing,
  type FaixaShopee as FaixaShopeePricing,
  type ParametrosGlobais,
} from '@mahou-hub/pricing';
import type {
  ResumoFinanceiro,
  RelatorioFinanceiroQuery,
  RelatorioFinanceiro,
} from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import {
  calcularVendaFinanceira,
  resumirFinanceiro,
  VENDA_FINANCEIRA_INCLUDE,
} from './financeiro-calculo';
import { definirPeriodoFinanceiro } from './financeiro-periodo';
import { montarRelatorioFinanceiro } from './financeiro-relatorio';

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  /** Preserva o resumo mensal legado; ex.: resumoMensal('2026-09'). */
  async resumoMensal(mes: string): Promise<ResumoFinanceiro> {
    if (!/^\d{4}-\d{2}$/.test(mes))
      throw new BadRequestException(`Mês ${mes} inválido; esperado YYYY-MM`);
    const periodo = definirPeriodoFinanceiro({ periodo: 'MENSAL', referencia: `${mes}-01` });
    const { vendas, custos, contexto } = await this.carregarPeriodo(periodo);
    const { gastosTotaisCentavos: _gastos, ...resumo } = resumirFinanceiro(
      vendas.map((venda) => ({
        canal: venda.canal,
        valores: calcularVendaFinanceira(venda, contexto),
      })),
      custos,
    );
    return { mes, ...resumo };
  }

  /** Relatório do período civil que contém a referência; ex.: SEMANAL + 2026-09-20. */
  async relatorio(entrada: RelatorioFinanceiroQuery): Promise<RelatorioFinanceiro> {
    const periodo = definirPeriodoFinanceiro(entrada);
    const { vendas, custos, contexto } = await this.carregarPeriodo(periodo);
    return montarRelatorioFinanceiro(periodo, vendas, custos, contexto);
  }

  private async carregarPeriodo({ gte, lt }: { gte: Date; lt: Date }) {
    const [vendas, custos, parametros, tabelaShopee, tabelaMercadoLivre] = await Promise.all([
      this.prisma.venda.findMany({
        where: { dataVenda: { gte, lt } },
        include: VENDA_FINANCEIRA_INCLUDE,
        orderBy: [{ dataVenda: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.custo.findMany({
        where: { dataCompetencia: { gte, lt } },
        orderBy: [{ dataCompetencia: 'asc' }, { id: 'asc' }],
      }),
      this.carregarParametros(),
      this.carregarTabelaShopee(),
      this.carregarTabelaMl(),
    ]);
    return { vendas, custos, contexto: { parametros, tabelaShopee, tabelaMercadoLivre } };
  }

  private async carregarParametros(): Promise<ParametrosGlobais> {
    const p = await this.prisma.parametro.findUnique({ where: { id: 1 } });
    if (!p) throw new NotFoundException('Parâmetros não inicializados');
    return {
      tarifaKwhCentavos: p.tarifaKwhCentavos,
      vendedorShopee: p.vendedorShopee,
      emCampanhaShopee: p.emCampanhaShopee,
      adicionalCampanhaPct: Number(p.adicionalCampanhaPct),
      comissaoMlPct: Number(p.comissaoMlPct),
      impostoAtivo: p.impostoAtivo,
      impostoPct: Number(p.impostoPct),
      tiktokComissaoPlataformaPct: Number(p.tiktokComissaoPlataformaPct),
      tiktokTaxaSfpPct: Number(p.tiktokTaxaSfpPct),
      tiktokComissaoAfiliadoPct: Number(p.tiktokComissaoAfiliadoPct),
      tiktokTaxaPagamentoPct: Number(p.tiktokTaxaPagamentoPct),
    };
  }

  private async carregarTabelaShopee(): Promise<FaixaShopeePricing[]> {
    const rows = await this.prisma.taxaShopee.findMany({
      orderBy: { limInferiorCentavos: 'asc' },
    });
    return rows.map((r) => ({
      limInferiorCentavos: r.limInferiorCentavos,
      comissaoPct: Number(r.comissaoPct),
      fixaCnpjCentavos: r.fixaCnpjCentavos,
      fixaCpfBaixoCentavos: r.fixaCpfBaixoCentavos,
      fixaCpfAltoCentavos: r.fixaCpfAltoCentavos,
    }));
  }

  private async carregarTabelaMl(): Promise<FaixaMlPricing[]> {
    const rows = await this.prisma.taxaMercadoLivre.findMany({
      orderBy: { limInferiorCentavos: 'asc' },
    });
    return rows.map((r) => ({
      faixa: r.faixa as 'A' | 'B' | 'C' | 'D' | 'E',
      limInferiorCentavos: r.limInferiorCentavos,
      custoFixoCentavos: r.custoFixoCentavos,
      pctAlternativo: Number(r.pctAlternativo),
      comissaoCategoriaPct: Number(r.comissaoCategoriaPct),
    }));
  }
}
