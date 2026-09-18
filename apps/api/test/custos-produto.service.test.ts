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
