import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ProdutosService } from '../src/modules/produtos/produtos.service';
import type { ImagensService } from '../src/modules/imagens/imagens.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

function makeImagensMock(): ImagensService {
  return { paraDto: vi.fn((row) => row) } as unknown as ImagensService;
}

/// Carrega parametros + tabelas vazias pro `list()` rodar sem explodir no enriquecimento.
function stubPricingDependencies(mock: ReturnType<typeof makePrismaMock>['mock']) {
  mock.parametro.findUnique.mockResolvedValue({
    id: 1,
    tarifaKwhCentavos: 100,
    vendedorShopee: 'CNPJ',
    emCampanhaShopee: false,
    adicionalCampanhaPct: new Prisma.Decimal(0),
    comissaoMlPct: new Prisma.Decimal(0.12),
    impostoAtivo: false,
    impostoPct: new Prisma.Decimal(0),
    tiktokComissaoPlataformaPct: new Prisma.Decimal(0.06),
    tiktokTaxaSfpPct: new Prisma.Decimal(0.05),
    tiktokComissaoAfiliadoPct: new Prisma.Decimal(0.07),
    tiktokTaxaPagamentoPct: new Prisma.Decimal(0.02),
  });
  mock.taxaShopee.findMany.mockResolvedValue([
    {
      limInferiorCentavos: 0,
      comissaoPct: new Prisma.Decimal(0.2),
      fixaCnpjCentavos: 200,
      fixaCpfBaixoCentavos: 200,
      fixaCpfAltoCentavos: 200,
    },
  ]);
  mock.taxaMercadoLivre.findMany.mockResolvedValue([
    {
      faixa: 'A',
      limInferiorCentavos: 0,
      custoFixoCentavos: 0,
      pctAlternativo: new Prisma.Decimal(0),
      comissaoCategoriaPct: new Prisma.Decimal(0.18),
    },
  ]);
}

function fakeProduto(overrides: Partial<{ id: string; nome: string; anunciado: boolean; inspiracao: string | null; modelo3dUrl: string | null }> = {}) {
  return {
    id: overrides.id ?? 'p1',
    nome: overrides.nome ?? 'Produto X',
    inspiracao: overrides.inspiracao ?? null,
    modelo3dUrl: overrides.modelo3dUrl ?? null,
    larguraCm: null,
    alturaCm: null,
    profundidadeCm: null,
    filamentoId: 'f1',
    pesoG: new Prisma.Decimal(100),
    tempoH: new Prisma.Decimal(2),
    impressora: 'A1',
    embalagemCentavos: 200,
    precoCentavos: 2990,
    canalPrincipal: 'SHOPEE',
    ativo: true,
    anunciado: overrides.anunciado ?? false,
    rascunho: false,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    filamento: {
      id: 'f1',
      nome: 'PETG',
      custoKgCentavos: 7000,
      potenciaA1W: 130,
      potenciaH2cW: 160,
    },
    insumos: [],
    imagens: [],
  };
}

describe('ProdutosService.list — filtros', () => {
  let mock: ReturnType<typeof makePrismaMock>['mock'];
  let svc: ProdutosService;

  beforeEach(() => {
    const m = makePrismaMock();
    mock = m.mock;
    stubPricingDependencies(mock);
    mock.produto.findMany.mockResolvedValue([] as never);
    mock.produto.count.mockResolvedValue(0 as never);
    svc = new ProdutosService(asPrisma(mock), makeImagensMock());
  });

  it('sempre filtra por ativo=true (soft-delete invisível)', async () => {
    await svc.list();
    const call = mock.produto.findMany.mock.calls[0]?.[0];
    expect(call?.where.ativo).toBe(true);
  });

  it('temReferencia=true exige inspiracao OU modelo3dUrl preenchido', async () => {
    await svc.list({ temReferencia: true });
    const call = mock.produto.findMany.mock.calls[0]?.[0];
    expect(call?.where.AND).toContainEqual({
      OR: [{ inspiracao: { not: null } }, { modelo3dUrl: { not: null } }],
    });
  });

  it('temReferencia=false exige inspiracao E modelo3dUrl ambos null', async () => {
    await svc.list({ temReferencia: false });
    const call = mock.produto.findMany.mock.calls[0]?.[0];
    expect(call?.where.inspiracao).toBeNull();
    expect(call?.where.modelo3dUrl).toBeNull();
  });

  it('temImagens=true filtra com imagens.some, temImagens=false com imagens.none', async () => {
    await svc.list({ temImagens: true });
    expect(mock.produto.findMany.mock.calls[0]?.[0].where.imagens).toEqual({ some: {} });
    mock.produto.findMany.mockClear();
    await svc.list({ temImagens: false });
    expect(mock.produto.findMany.mock.calls[0]?.[0].where.imagens).toEqual({ none: {} });
  });

  it('combina temReferencia=true + q sem perder nenhum dos dois (regressão: OR direto sobrescreveria)', async () => {
    await svc.list({ temReferencia: true, q: 'porta' });
    const where = mock.produto.findMany.mock.calls[0]?.[0].where;
    // Ambos devem aparecer em AND
    expect(where.AND).toHaveLength(2);
    expect(where.AND).toContainEqual({
      OR: [{ inspiracao: { not: null } }, { modelo3dUrl: { not: null } }],
    });
    expect(where.AND).toContainEqual({
      OR: [
        { nome: { contains: 'porta', mode: 'insensitive' } },
        { inspiracao: { contains: 'porta', mode: 'insensitive' } },
      ],
    });
  });

  it('paginação: page=2, pageSize=10 vira skip=10, take=10', async () => {
    await svc.list({ page: 2, pageSize: 10 });
    const call = mock.produto.findMany.mock.calls[0]?.[0];
    expect(call?.skip).toBe(10);
    expect(call?.take).toBe(10);
  });

  it('sem page+pageSize: skip undefined, take undefined (devolve tudo — comportamento histórico)', async () => {
    await svc.list();
    const call = mock.produto.findMany.mock.calls[0]?.[0];
    expect(call?.skip).toBeUndefined();
    expect(call?.take).toBeUndefined();
  });

  it('enriquece com pricing — items vêm com bloco pricing calculado', async () => {
    mock.produto.findMany.mockResolvedValue([fakeProduto()] as never);
    mock.produto.count.mockResolvedValue(1 as never);
    const { items, total } = await svc.list();
    expect(total).toBe(1);
    expect(items[0]).toHaveProperty('pricing');
    expect(items[0]?.pricing.custoTotalProducaoCentavos).toBeGreaterThan(0);
    expect(items[0]?.pricing.taxaShopeeCentavos).toBeGreaterThan(0);
  });
});

describe('ProdutosService.marcarAnunciados', () => {
  it('chama updateMany com anunciado=true pra ids dados', async () => {
    const { mock } = makePrismaMock();
    mock.produto.updateMany.mockResolvedValue({ count: 2 } as never);
    const svc = new ProdutosService(asPrisma(mock), makeImagensMock());
    const r = await svc.marcarAnunciados(['a', 'b'], true);
    expect(r).toEqual({ ok: true, count: 2 });
    expect(mock.produto.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      data: { anunciado: true },
    });
  });
});

describe('ProdutosService.desativarMuitos', () => {
  it('soft-delete em massa preserva referência histórica', async () => {
    const { mock } = makePrismaMock();
    mock.produto.updateMany.mockResolvedValue({ count: 3 } as never);
    const svc = new ProdutosService(asPrisma(mock), makeImagensMock());
    const r = await svc.desativarMuitos(['x', 'y', 'z']);
    expect(r).toEqual({ ok: true, count: 3 });
    const call = mock.produto.updateMany.mock.calls[0]?.[0];
    expect(call?.data).toEqual({ ativo: false });
  });
});
