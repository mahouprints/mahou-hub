import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { DataRelatorioSchema, RelatorioFinanceiroSchema, type Canal } from '@mahou-hub/contracts';
import { FinanceiroService } from '../src/modules/financeiro/financeiro.service';
import {
  definirPeriodoFinanceiro,
  intervalosSerieFinanceira,
} from '../src/modules/financeiro/financeiro-periodo';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

function prepararFinanceiro() {
  const { mock } = makePrismaMock();
  mock.parametro.findUnique.mockResolvedValue({
    tarifaKwhCentavos: 100,
    vendedorShopee: 'CNPJ',
    emCampanhaShopee: false,
    adicionalCampanhaPct: 0,
    comissaoMlPct: 10,
    impostoAtivo: true,
    impostoPct: 6,
    tiktokComissaoPlataformaPct: 6,
    tiktokTaxaSfpPct: 5,
    tiktokComissaoAfiliadoPct: 7,
    tiktokTaxaPagamentoPct: 2,
  });
  mock.taxaShopee.findMany.mockResolvedValue([
    {
      limInferiorCentavos: 0,
      comissaoPct: 20,
      fixaCnpjCentavos: 200,
      fixaCpfBaixoCentavos: 200,
      fixaCpfAltoCentavos: 200,
    },
  ]);
  mock.taxaMercadoLivre.findMany.mockResolvedValue([
    {
      faixa: 'A',
      limInferiorCentavos: 0,
      custoFixoCentavos: 100,
      pctAlternativo: 0,
      comissaoCategoriaPct: 10,
    },
  ]);
  mock.venda.findMany.mockResolvedValue([]);
  mock.custo.findMany.mockResolvedValue([]);
  return { mock, service: new FinanceiroService(asPrisma(mock)) };
}

function venda(id: string, canal: Canal, qtd: number, dia: string, produtoId = 'p1') {
  const filamento = {
    nome: 'PLA genérico',
    custoKgCentavos: 6000,
    potenciaA1W: 100,
    potenciaH2cW: 200,
  };
  return {
    id,
    canal,
    qtd,
    produtoId,
    precoUnitarioCentavos: 5000,
    dataVenda: new Date(`${dia}T00:00:00.000Z`),
    observacao: `Observação ${id}\nSegundo parágrafo`,
    produto: {
      id: produtoId,
      nome: `Peça ${produtoId}`,
      ativo: false,
      filamento,
      pesoG: new Prisma.Decimal(190),
      tempoH: new Prisma.Decimal(2),
      impressora: 'A1',
      embalagemCentavos: 100,
      filamentos: [
        [100, 6000],
        [50, 7000],
        [25, 8000],
        [10, 10000],
        [5, 12000],
      ].map(([peso, preco]) => ({
        pesoG: new Prisma.Decimal(peso!),
        filamento: { ...filamento, custoKgCentavos: preco! },
      })),
      insumos: [
        { qtd: new Prisma.Decimal(1), insumo: { custoUnitarioCentavos: 250 } },
        { qtd: new Prisma.Decimal('0.125'), insumo: { custoUnitarioCentavos: 100 } },
      ],
    },
  };
}

function custo(id: string, valorCentavos: number, dia: string, categoria = 'SOFTWARE') {
  return {
    id,
    descricao: `Despesa ${id}`,
    categoria,
    valorCentavos,
    dataCompetencia: new Date(`${dia}T00:00:00.000Z`),
    observacao: `Nota ${id}`,
  };
}

describe('calendário do relatório financeiro', () => {
  it.each([
    ['2028-02-29', '2028-03-01', 'Dia 29/02/2028'],
    ['2026-12-31', '2027-01-01', 'Dia 31/12/2026'],
  ])('período diário %s usa somente o dia civil escolhido', (referencia, proximo, titulo) => {
    const periodo = definirPeriodoFinanceiro({ periodo: 'DIARIO', referencia });
    expect(periodo).toMatchObject({
      inicio: referencia,
      fim: referencia,
      titulo,
      gte: new Date(`${referencia}T00:00:00.000Z`),
      lt: new Date(`${proximo}T00:00:00.000Z`),
    });
    expect(intervalosSerieFinanceira(periodo)).toHaveLength(1);
  });

  it.each([
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-09-00',
    '2026-9-01',
    '0000-01-01',
  ])('rejeita data inexistente ou inválida %s', (dia) => {
    expect(DataRelatorioSchema.safeParse(dia).success).toBe(false);
  });

  it('aceita 29 de fevereiro bissexto e preenche todos os 29 dias', () => {
    expect(DataRelatorioSchema.safeParse('2028-02-29').success).toBe(true);
    const periodo = definirPeriodoFinanceiro({ periodo: 'MENSAL', referencia: '2028-02-29' });
    expect(periodo).toMatchObject({
      inicio: '2028-02-01',
      fim: '2028-02-29',
      lt: new Date('2028-03-01Z'),
    });
    expect(intervalosSerieFinanceira(periodo)).toHaveLength(29);
  });

  it.each(['2026-12-28', '2027-01-01', '2027-01-03'])(
    'semana de %s começa segunda e cruza ano até domingo',
    (referencia) => {
      const periodo = definirPeriodoFinanceiro({ periodo: 'SEMANAL', referencia });
      expect(periodo).toMatchObject({
        inicio: '2026-12-28',
        fim: '2027-01-03',
        lt: new Date('2027-01-04Z'),
      });
      expect(intervalosSerieFinanceira(periodo).map((ponto) => ponto.inicio)).toEqual([
        '2026-12-28',
        '2026-12-29',
        '2026-12-30',
        '2026-12-31',
        '2027-01-01',
        '2027-01-02',
        '2027-01-03',
      ]);
    },
  );

  it('ano civil tem 12 meses, inclusive fevereiro bissexto e dezembro completos', () => {
    const periodo = definirPeriodoFinanceiro({ periodo: 'ANUAL', referencia: '2028-09-20' });
    const serie = intervalosSerieFinanceira(periodo);
    expect(periodo).toMatchObject({
      inicio: '2028-01-01',
      fim: '2028-12-31',
      lt: new Date('2029-01-01Z'),
    });
    expect(serie).toHaveLength(12);
    expect(serie[1]).toMatchObject({ inicio: '2028-02-01', fim: '2028-02-29' });
    expect(serie[11]).toMatchObject({ inicio: '2028-12-01', fim: '2028-12-31' });
  });
});

describe('FinanceiroService.relatorio', () => {
  it('relatório diário filtra o dia selecionado e concilia venda e custo da data', async () => {
    const { mock, service } = prepararFinanceiro();
    mock.venda.findMany.mockResolvedValue([venda('vd', 'SITE', 4, '2028-02-29')]);
    mock.custo.findMany.mockResolvedValue([custo('cd', 1000, '2028-02-29')]);
    const relatorio = await service.relatorio({ periodo: 'DIARIO', referencia: '2028-02-29' });
    expect(RelatorioFinanceiroSchema.safeParse(relatorio).success).toBe(true);
    const range = { gte: new Date('2028-02-29Z'), lt: new Date('2028-03-01Z') };
    expect(mock.venda.findMany.mock.calls[0]?.[0].where).toEqual({ dataVenda: range });
    expect(mock.custo.findMany.mock.calls[0]?.[0].where).toEqual({ dataCompetencia: range });
    expect(relatorio.serie).toHaveLength(1);
    expect(relatorio.serie[0]).toMatchObject({
      inicio: '2028-02-29',
      fim: '2028-02-29',
      faturamentoCentavos: 20000,
      gastosTotaisCentavos: 8972,
      lucroLiquidoCentavos: 11028,
    });
    expect(relatorio.resumo.lucroLiquidoCentavos).toBe(11028);
  });

  it('concilia detalhes, série, canais, produtos e categorias com o resumo legado', async () => {
    const { mock, service } = prepararFinanceiro();
    mock.venda.findMany.mockResolvedValue([
      venda('v1', 'SHOPEE', 2, '2026-09-01'),
      venda('v2', 'ML', 3, '2026-09-05'),
      venda('v3', 'SITE', 4, '2026-09-30', 'p2'),
      venda('v4', 'TIKTOK', 1, '2026-09-30', 'p2'),
    ]);
    mock.custo.findMany.mockResolvedValue([
      custo('c1', 1000, '2026-09-01', 'ALUGUEL'),
      custo('c2', 500, '2026-09-30'),
    ]);
    const relatorio = await service.relatorio({ periodo: 'MENSAL', referencia: '2026-09-20' });
    expect(RelatorioFinanceiroSchema.safeParse(relatorio).success).toBe(true);
    expect(relatorio.resumo).toMatchObject({
      faturamentoCentavos: 50000,
      custosVariaveisCentavos: 14300,
      custosInsumosCentavos: 2630,
      impostosCentavos: 3000,
      taxasMarketplaceCentavos: 5200,
      custosGeraisCentavos: 1500,
      gastosTotaisCentavos: 26630,
      lucroLiquidoCentavos: 23370,
      qtdVendas: 4,
      qtdItensVendidos: 10,
      porCanal: { SHOPEE: 10000, ML: 15000, SITE: 20000, TIKTOK: 5000 },
    });
    for (const campo of [
      'faturamentoCentavos',
      'custosVariaveisCentavos',
      'custosInsumosCentavos',
      'impostosCentavos',
      'taxasMarketplaceCentavos',
      'qtdItensVendidos',
      'qtdVendas',
    ] as const) {
      expect(relatorio.porCanal.reduce((total, linha) => total + linha[campo], 0)).toBe(
        relatorio.resumo[campo],
      );
      expect(relatorio.porProduto.reduce((total, linha) => total + linha[campo], 0)).toBe(
        relatorio.resumo[campo],
      );
      expect(relatorio.serie.reduce((total, linha) => total + linha[campo], 0)).toBe(
        relatorio.resumo[campo],
      );
    }
    expect(relatorio.vendas.map((v) => v.lucroContribuicaoCentavos)).toEqual([
      3614, 7221, 12028, 2007,
    ]);
    expect(relatorio.vendas[0]?.dataVenda).toBe('2026-09-01');
    expect(relatorio.vendas[0]?.observacao).toBe('Observação v1\nSegundo parágrafo');
    expect(relatorio.custosGerais[0]).toMatchObject({
      descricao: 'Despesa c1',
      observacao: 'Nota c1',
      dataCompetencia: '2026-09-01',
    });
    expect(relatorio.porCategoria.reduce((total, linha) => total + linha.valorCentavos, 0)).toBe(
      1500,
    );
    expect(relatorio.serie.reduce((total, linha) => total + linha.lucroLiquidoCentavos, 0)).toBe(
      23370,
    );
    expect(relatorio.serie).toHaveLength(30);
    expect(relatorio.serie[1]).toMatchObject({
      faturamentoCentavos: 0,
      gastosTotaisCentavos: 0,
      lucroLiquidoCentavos: 0,
    });
    const { gastosTotaisCentavos: _gastos, ...resumo } = relatorio.resumo;
    expect(await service.resumoMensal('2026-09')).toEqual({ mes: '2026-09', ...resumo });
    expect(mock.movimentoEstoque.findMany).not.toHaveBeenCalled();
  });

  it('filtra semana com limite superior exclusivo e mantém dias zerados', async () => {
    const { mock, service } = prepararFinanceiro();
    const relatorio = await service.relatorio({ periodo: 'SEMANAL', referencia: '2027-01-03' });
    const range = { gte: new Date('2026-12-28Z'), lt: new Date('2027-01-04Z') };
    expect(mock.venda.findMany.mock.calls[0]?.[0].where).toEqual({ dataVenda: range });
    expect(mock.custo.findMany.mock.calls[0]?.[0].where).toEqual({ dataCompetencia: range });
    expect(relatorio.serie).toHaveLength(7);
    expect(relatorio.resumo).toMatchObject({
      faturamentoCentavos: 0,
      lucroLiquidoCentavos: 0,
      margem: 0,
    });
    expect(relatorio.porCanal).toHaveLength(4);
    expect(relatorio.porProduto).toEqual([]);
  });

  it('relatório anual atribui custo ao mês civil e mostra prejuízo sem vendas', async () => {
    const { mock, service } = prepararFinanceiro();
    mock.custo.findMany.mockResolvedValue([custo('c1', 1500, '2028-02-29')]);
    const relatorio = await service.relatorio({ periodo: 'ANUAL', referencia: '2028-09-20' });
    expect(relatorio.serie).toHaveLength(12);
    expect(relatorio.serie[1]).toMatchObject({
      gastosTotaisCentavos: 1500,
      lucroLiquidoCentavos: -1500,
      margem: 0,
    });
    expect(relatorio.resumo.lucroLiquidoCentavos).toBe(-1500);
    expect(relatorio.custosGerais[0]?.dataCompetencia).toBe('2028-02-29');
  });

  it('valida data antes de consultar e mantém erro 400 para mês inválido legado', async () => {
    const { mock, service } = prepararFinanceiro();
    await expect(
      service.relatorio({ periodo: 'MENSAL', referencia: '2026-02-30' }),
    ).rejects.toThrow('YYYY-MM-DD existente');
    await expect(service.resumoMensal('2026-13')).rejects.toThrow('YYYY-MM-DD existente');
    expect(mock.venda.findMany).not.toHaveBeenCalled();
  });
});
