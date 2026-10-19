import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { ProdutoVariacaoComPricingSchema } from '@mahou-hub/contracts';
import { VariacoesService } from '../src/modules/variacoes/variacoes.service';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { FinanceiroService } from '../src/modules/financeiro/financeiro.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

const branco = { nome: 'Branco', custoKgCentavos: 6000, potenciaA1W: 100, potenciaH2cW: 200 };
const azul = { nome: 'Azul', custoKgCentavos: 10000, potenciaA1W: 200, potenciaH2cW: 300 };

function produto() {
  const mercadoLivre = {
    categoriaId: 'MLB1839',
    tipoAnuncio: 'gold_special',
    modoEnvio: 'me2',
    tipoLogistica: 'xd_drop_off',
    freteGratis: true,
    condicao: 'new',
    pesoGramas: 120,
    alturaCm: 5,
    larguraCm: 10,
    comprimentoCm: 15,
  };
  return {
    id: 'p1',
    nome: 'Articulado',
    filamentoId: 'branco',
    filamento: branco,
    pesoG: new Prisma.Decimal(100),
    tempoH: new Prisma.Decimal(1),
    precoCentavos: 2000,
    impressora: 'A1',
    embalagemCentavos: 0,
    filamentos: [{ filamentoId: 'branco', pesoG: new Prisma.Decimal(100), filamento: branco }],
    insumos: [{ qtd: new Prisma.Decimal(1), insumo: { custoUnitarioCentavos: 40 } }],
    mercadoLivre,
    cotacaoMl: {
      contexto: { ...mercadoLivre, precoCentavos: 2000 },
      categoriaNome: 'Figuras de Ação',
      tarifaCentavos: 230,
      freteCentavos: 0,
      tarifaFixaCentavos: 0,
      percentualTarifa: 11.5,
      cotadoEm: new Date().toISOString(),
      pendencias: [],
    },
  };
}

function variacao(over: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    produtoId: 'p1',
    nome: 'Azul',
    sku: 'ART-AZ',
    filamentoId: 'azul',
    filamento: azul,
    pesoG: null,
    tempoH: null,
    precoCentavos: null,
    estoqueAtual: 0,
    estoqueMinimo: 0,
    ativo: true,
    ...over,
  };
}

function preparar() {
  const { mock } = makePrismaMock();
  mock.produto.findUnique.mockResolvedValue(produto());
  mock.produtoVariacao.findMany.mockResolvedValue([variacao()]);
  mock.parametro.findUnique.mockResolvedValue({
    tarifaKwhCentavos: 85,
    vendedorShopee: 'CNPJ',
    emCampanhaShopee: false,
    adicionalCampanhaPct: 0,
    comissaoMlPct: 10,
    impostoAtivo: true,
    impostoPct: 6,
    tiktokComissaoPlataformaPct: 0,
    tiktokTaxaSfpPct: 0,
    tiktokComissaoAfiliadoPct: 0,
    tiktokTaxaPagamentoPct: 0,
  });
  mock.taxaShopee.findMany.mockResolvedValue([
    {
      limInferiorCentavos: 0,
      comissaoPct: 20,
      fixaCnpjCentavos: 400,
      fixaCpfBaixoCentavos: 400,
      fixaCpfAltoCentavos: 400,
    },
  ]);
  mock.taxaMercadoLivre.findMany.mockResolvedValue([]);
  mock.custo.findMany.mockResolvedValue([]);
  const prisma = asPrisma(mock);
  return {
    mock,
    variacoes: new VariacoesService(prisma, new PricingService(prisma)),
    financeiro: new FinanceiroService(prisma),
  };
}

describe('pricing por variação', () => {
  it('troca a composição branca pela cor vendida e usa sua potência, sem duplicar embalagem', async () => {
    const { variacoes } = preparar();
    const [linha] = await variacoes.listByProduto('p1');
    expect(linha).toMatchObject({
      precoEfetivoCentavos: 2000,
      pesoEfetivoG: 100,
      tempoEfetivoH: 1,
      pricingPendencias: [],
    });
    expect(linha?.pricing).toMatchObject({
      custoFilamentoCentavos: 1000,
      custoEnergiaCentavos: 17,
      custoTotalProducaoCentavos: 1057,
      taxaMlCentavos: 230,
      freteMlCentavos: 0,
      liquidoMlCentavos: 593,
      custosMlStatus: 'COTADO',
    });
  });

  it.each([{ filamentos: [] }, { filamentos: produto().filamentos }])(
    'herda os custos quando os overrides são nulos (receita %j)',
    async ({ filamentos }) => {
      const { mock, variacoes } = preparar();
      mock.produto.findUnique.mockResolvedValue({ ...produto(), filamentos });
      mock.produtoVariacao.findMany.mockResolvedValue([
        variacao({ filamentoId: null, filamento: null }),
      ]);
      const [linha] = await variacoes.listByProduto('p1');
      expect(linha?.pricing).toMatchObject({
        custoFilamentoCentavos: 600,
        custoEnergiaCentavos: 9,
        custoTotalProducaoCentavos: 649,
      });
    },
  );

  it.each([{ precoCentavos: 2500 }, { pesoG: new Prisma.Decimal(200) }])(
    'não usa cotação de outro preço ou pacote: %j',
    async (override) => {
      const { mock, variacoes } = preparar();
      mock.produtoVariacao.findMany.mockResolvedValue([variacao(override)]);
      const [linha] = await variacoes.listByProduto('p1');
      expect(linha?.pricing).toMatchObject({
        taxaMlCentavos: null,
        freteMlCentavos: null,
        liquidoMlCentavos: null,
        margemMl: null,
        custosMlStatus: 'PENDENTE',
      });
    },
  );

  it('aplica peso e tempo próprios no material e na energia', async () => {
    const { mock, variacoes } = preparar();
    mock.produtoVariacao.findMany.mockResolvedValue([
      variacao({
        pesoG: new Prisma.Decimal(200),
        tempoH: new Prisma.Decimal(2),
        precoCentavos: 2500,
      }),
    ]);
    const [linha] = await variacoes.listByProduto('p1');
    expect(linha).toMatchObject({
      precoEfetivoCentavos: 2500,
      pesoEfetivoG: 200,
      tempoEfetivoH: 2,
    });
    expect(
      ProdutoVariacaoComPricingSchema.safeParse(JSON.parse(JSON.stringify(linha))).success,
    ).toBe(true);
    expect(linha?.pricing).toMatchObject({
      custoFilamentoCentavos: 2000,
      custoEnergiaCentavos: 34,
      custoTotalProducaoCentavos: 2074,
      impostoCentavos: 150,
    });
  });

  it('mantém receita com vários materiais quando a variação herda a composição', async () => {
    const { mock, variacoes } = preparar();
    mock.produto.findUnique.mockResolvedValue(multicolorido());
    mock.produtoVariacao.findMany.mockResolvedValue([
      variacao({ filamentoId: null, filamento: null, pesoG: new Prisma.Decimal(150) }),
    ]);
    const [linha] = await variacoes.listByProduto('p1');
    expect(linha?.pricing).toMatchObject({
      custoFilamentoCentavos: 1100,
      custoEnergiaCentavos: 9,
      custoTotalProducaoCentavos: 1149,
    });
  });

  it.each([
    { filamentoId: 'azul', filamento: azul },
    { filamentoId: null, filamento: null, pesoG: 200 },
  ])('sinaliza composição ambígua sem mostrar uma margem falsa: %j', async (override) => {
    const { mock, variacoes } = preparar();
    mock.produto.findUnique.mockResolvedValue(multicolorido());
    mock.produtoVariacao.findMany.mockResolvedValue([variacao(override)]);
    const [linha] = await variacoes.listByProduto('p1');
    expect(linha?.pricing).toBeNull();
    expect(linha?.pricingPendencias).toHaveLength(1);
  });
});

function multicolorido() {
  return {
    ...produto(),
    pesoG: new Prisma.Decimal(150),
    filamentos: [
      ...produto().filamentos,
      { filamentoId: 'azul', pesoG: new Prisma.Decimal(50), filamento: azul },
    ],
  };
}

describe('financeiro por variação', () => {
  it('usa custo da cor e preço vendido, preservando tarifa/frete reais totais da linha', async () => {
    const { mock, financeiro } = preparar();
    mock.venda.findMany.mockResolvedValue([
      {
        produto: produto(),
        variacao: variacao({ precoCentavos: 9999 }),
        canal: 'ML',
        qtd: 2,
        precoUnitarioCentavos: 2000,
        pedidoItem: {
          qtd: 2,
          precoUnitarioCentavos: 2000,
          tarifaMlCentavos: 460,
          freteMlCentavos: 100,
          custosMlAtualizadosEm: new Date(),
        },
      },
    ]);
    const resumo = await financeiro.resumoMensal('2026-10');
    expect(resumo).toMatchObject({
      faturamentoCentavos: 4000,
      custosVariaveisCentavos: 2034,
      custosInsumosCentavos: 80,
      impostosCentavos: 240,
      taxasMarketplaceCentavos: 460,
      fretesCentavos: 100,
      lucroLiquidoCentavos: 1086,
      vendasMlComCustosReais: 1,
    });
    expect(mock.venda.findMany.mock.calls[0]?.[0].include.variacao).toEqual({
      include: { filamento: true },
    });
  });

  it('venda sem variação preserva custo base, inclusive produto arquivado', async () => {
    const { mock, financeiro } = preparar();
    mock.venda.findMany.mockResolvedValue([
      {
        produto: { ...produto(), ativo: false },
        variacao: null,
        canal: 'SITE',
        qtd: 1,
        precoUnitarioCentavos: 2000,
      },
    ]);
    const resumo = await financeiro.resumoMensal('2026-10');
    expect(resumo).toMatchObject({
      custosVariaveisCentavos: 609,
      custosInsumosCentavos: 40,
      lucroLiquidoCentavos: 1231,
    });
  });

  it('não substitui nem apaga composição múltipla em histórico com override antigo ambíguo', async () => {
    const { mock, financeiro } = preparar();
    mock.venda.findMany.mockResolvedValue([
      {
        produto: multicolorido(),
        variacao: variacao({ pesoG: 200 }),
        canal: 'SITE',
        qtd: 1,
        precoUnitarioCentavos: 2000,
      },
    ]);
    const resumo = await financeiro.resumoMensal('2026-10');
    expect(resumo).toMatchObject({
      custosVariaveisCentavos: 1109,
      custosInsumosCentavos: 40,
      lucroLiquidoCentavos: 731,
    });
  });
});
