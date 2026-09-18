import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { FinanceiroService } from '../src/modules/financeiro/financeiro.service';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

const filamento = {
  nome: 'PLA de teste',
  custoKgCentavos: 6000,
  potenciaA1W: 100,
  potenciaH2cW: 200,
};

function produtoComInsumos() {
  return {
    id: 'p1',
    nome: 'Peça de teste',
    filamentoId: 'f1',
    filamento,
    filamentos: [],
    pesoG: new Prisma.Decimal(100),
    tempoH: new Prisma.Decimal(2),
    impressora: 'A1',
    embalagemCentavos: 100,
    precoCentavos: 2000,
    canalPrincipal: 'SITE',
    ativo: true,
    insumos: [
      { qtd: new Prisma.Decimal(1), insumo: { custoUnitarioCentavos: 250 } },
      { qtd: new Prisma.Decimal('0.125'), insumo: { custoUnitarioCentavos: 100 } },
    ],
  };
}

function prepararCustos(mock: ReturnType<typeof makePrismaMock>['mock']) {
  mock.parametro.findUnique.mockResolvedValue({
    tarifaKwhCentavos: 100,
    vendedorShopee: 'CNPJ',
    emCampanhaShopee: false,
    adicionalCampanhaPct: 0,
    comissaoMlPct: 10,
    impostoAtivo: false,
    impostoPct: 0,
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
  mock.filamento.findUnique.mockResolvedValue(filamento);
  mock.custo.findMany.mockResolvedValue([]);
}

describe('FinanceiroService — insumos por unidade vendida', () => {
  let mock: ReturnType<typeof makePrismaMock>['mock'];
  let service: FinanceiroService;

  beforeEach(() => {
    mock = makePrismaMock().mock;
    prepararCustos(mock);
    service = new FinanceiroService(asPrisma(mock));
  });

  it.each([true, false])(
    'desconta insumos sem duplicar e mantém vendas de produto ativo=%s',
    async (ativo) => {
      const produto = { ...produtoComInsumos(), ativo };
      mock.venda.findMany.mockResolvedValue([
        { produto, qtd: 3, precoUnitarioCentavos: 2000, canal: 'SITE' },
        { produto, qtd: 2, precoUnitarioCentavos: 1800, canal: 'SITE' },
      ]);
      mock.custo.findMany.mockResolvedValue([{ valorCentavos: 100 }]);

      const resumo = await service.resumoMensal('2026-01');

      // Unitário: 600 filamento + 20 energia + 100 embalagem + 250 + 13 insumos.
      expect(resumo.faturamentoCentavos).toBe(9600);
      expect(resumo.custosVariaveisCentavos).toBe(720 * 5);
      expect(resumo.custosInsumosCentavos).toBe(263 * 5);
      expect(resumo.lucroLiquidoCentavos).toBe(4585);
      expect(resumo.qtdItensVendidos).toBe(5);
      expect(mock.venda.findMany.mock.calls[0]?.[0].where).toEqual({
        dataVenda: { gte: new Date('2026-01-01Z'), lt: new Date('2026-02-01Z') },
      });
    },
  );

  it('produto sem insumos mantém custo zero nessa categoria', async () => {
    mock.venda.findMany.mockResolvedValue([
      {
        produto: { ...produtoComInsumos(), insumos: [] },
        qtd: 2,
        precoUnitarioCentavos: 2000,
        canal: 'SITE',
      },
    ]);

    const resumo = await service.resumoMensal('2026-01');

    expect(resumo.custosInsumosCentavos).toBe(0);
    expect(resumo.lucroLiquidoCentavos).toBe(2560);
  });
});

describe('PricingService.simular — custo completo por unidade', () => {
  it.each([
    ['SITE', 1017],
    ['SHOPEE', 417],
    ['ML', 717],
    ['TIKTOK', 617],
  ])(
    'desconta insumos e taxas do canal %s em todas as unidades',
    async (canalPrincipal, liquidoUnitario) => {
      const { mock } = makePrismaMock();
      prepararCustos(mock);
      mock.produto.findUnique.mockResolvedValue({ ...produtoComInsumos(), canalPrincipal });
      const service = new PricingService(asPrisma(mock));

      const resumo = await service.simular({
        produtoId: 'p1',
        horasPorDia: 8,
        dias: 1,
        utilizacaoPct: 100,
        numeroImpressoras: 1,
      });

      expect(mock.produto.findUnique.mock.calls[0]?.[0].include.insumos).toEqual({
        include: { insumo: true },
      });
      expect(resumo.capacidadeUnidades).toBe(4);
      expect(resumo.faturamentoCentavos).toBe(8000);
      expect(resumo.lucroLiquidoCentavos).toBe(Number(liquidoUnitario) * 4);
    },
  );
});

function composicaoCincoFilamentos() {
  return [
    [100, 6000],
    [50, 7000],
    [25, 8000],
    [10, 10000],
    [5, 12000],
  ].map(([pesoG, custoKgCentavos], ordem) => ({
    filamentoId: `f${ordem + 1}`,
    pesoG: new Prisma.Decimal(pesoG!),
    ordem,
    filamento: {
      ...filamento,
      id: `f${ordem + 1}`,
      custoKgCentavos: custoKgCentavos!,
      potenciaA1W: 900,
    },
  }));
}

describe('múltiplos filamentos — cálculo, projeção e financeiro', () => {
  it('API calcula cada material e usa o primeiro do input para energia', async () => {
    const { mock } = makePrismaMock();
    prepararCustos(mock);
    const itens = composicaoCincoFilamentos();
    itens[0]!.filamento.potenciaA1W = 100;
    mock.filamento.findMany.mockResolvedValue(itens.map((item) => item.filamento).reverse());
    const service = new PricingService(asPrisma(mock));

    const resultado = await service.calcular({
      pesoG: 999,
      tempoH: 2,
      impressora: 'A1',
      embalagemCentavos: 100,
      precoCentavos: 5000,
      filamentos: itens.map((item) => ({
        filamentoId: item.filamentoId,
        pesoG: Number(item.pesoG),
      })),
    });

    expect(resultado.custoFilamentoCentavos).toBe(1310);
    expect(resultado.custoEnergiaCentavos).toBe(20);
    expect(resultado.custoTotalProducaoCentavos).toBe(1430);
    expect(mock.filamento.findMany).toHaveBeenCalledTimes(1);
    expect(mock.filamento.findUnique).not.toHaveBeenCalled();
  });

  it('API arredonda meio centavo apenas após somar todos os materiais', async () => {
    const { mock } = makePrismaMock();
    prepararCustos(mock);
    mock.filamento.findMany.mockResolvedValue([{ ...filamento, id: 'f1', custoKgCentavos: 5000 }]);
    const service = new PricingService(asPrisma(mock));

    const resultado = await service.calcular({
      pesoG: 0.3,
      tempoH: 2,
      impressora: 'A1',
      embalagemCentavos: 100,
      precoCentavos: 5000,
      filamentos: [{ filamentoId: 'f1', pesoG: 0.3 }],
    });

    expect(resultado.custoFilamentoCentavos).toBe(2);
  });

  it('API avisa se algum material não existe sem ignorar seu peso', async () => {
    const { mock } = makePrismaMock();
    prepararCustos(mock);
    mock.filamento.findMany.mockResolvedValue([{ ...filamento, id: 'f1' }]);
    const service = new PricingService(asPrisma(mock));

    await expect(
      service.calcular({
        pesoG: 50,
        tempoH: 2,
        impressora: 'A1',
        embalagemCentavos: 100,
        precoCentavos: 5000,
        filamentos: [
          { filamentoId: 'f1', pesoG: 25 },
          { filamentoId: 'ausente', pesoG: 25 },
        ],
      }),
    ).rejects.toThrow('Filamento ausente não existe');
  });

  it('financeiro multiplica o custo de todos os materiais pela quantidade vendida', async () => {
    const { mock } = makePrismaMock();
    prepararCustos(mock);
    const produto = {
      ...produtoComInsumos(),
      filamentos: composicaoCincoFilamentos(),
      ativo: false,
    };
    mock.venda.findMany.mockResolvedValue([
      { produto, qtd: 3, precoUnitarioCentavos: 5000, canal: 'SITE' },
    ]);

    const resumo = await new FinanceiroService(asPrisma(mock)).resumoMensal('2026-01');

    expect(resumo.faturamentoCentavos).toBe(15000);
    expect(resumo.custosVariaveisCentavos).toBe(1430 * 3);
    expect(resumo.custosInsumosCentavos).toBe(263 * 3);
    expect(resumo.lucroLiquidoCentavos).toBe(9921);
    expect(mock.venda.findMany.mock.calls[0]?.[0].include.produto.include.filamentos).toEqual({
      include: { filamento: true },
    });
  });

  it.each([
    ['SITE', 3307],
    ['SHOPEE', 2107],
    ['ML', 2707],
    ['TIKTOK', 2307],
  ])('simulador inclui materiais, insumos e taxas do canal %s', async (canalPrincipal, liquido) => {
    const { mock } = makePrismaMock();
    prepararCustos(mock);
    mock.produto.findUnique.mockResolvedValue({
      ...produtoComInsumos(),
      filamentos: composicaoCincoFilamentos(),
      precoCentavos: 5000,
      canalPrincipal,
    });

    const resumo = await new PricingService(asPrisma(mock)).simular({
      produtoId: 'p1',
      horasPorDia: 8,
      dias: 1,
      utilizacaoPct: 100,
      numeroImpressoras: 1,
    });

    expect(resumo.capacidadeUnidades).toBe(4);
    expect(resumo.faturamentoCentavos).toBe(20000);
    expect(resumo.lucroLiquidoCentavos).toBe(Number(liquido) * 4);
    expect(mock.filamento.findMany).not.toHaveBeenCalled();
    expect(mock.filamento.findUnique).not.toHaveBeenCalled();
  });
});
