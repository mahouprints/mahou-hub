import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ProdutosService } from '../src/modules/produtos/produtos.service';
import type { ImagensService } from '../src/modules/imagens/imagens.service';
import type { MediaUrlService } from '../src/modules/imagens/media-url.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

// Só a vitrine usa o MediaUrlService; nos demais testes o stub existe pro construtor.
function makeMediaUrlMock(): MediaUrlService {
  return { publicUrl: vi.fn((a: string) => `https://media.test/${a}`) } as unknown as MediaUrlService;
}

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
    svc = new ProdutosService(asPrisma(mock), makeImagensMock(), makeMediaUrlMock());
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
    expect(mock.produto.findMany.mock.calls[0]?.[0].where.AND).toContainEqual({ imagens: { some: {} } });
    mock.produto.findMany.mockClear();
    await svc.list({ temImagens: false });
    expect(mock.produto.findMany.mock.calls[0]?.[0].where.AND).toContainEqual({ imagens: { none: {} } });
  });

  it('temImagemGerada=true exige origem=GERADA, =false exige ausência', async () => {
    await svc.list({ temImagemGerada: true });
    expect(mock.produto.findMany.mock.calls[0]?.[0].where.AND).toContainEqual({
      imagens: { some: { origem: 'GERADA' } },
    });
    mock.produto.findMany.mockClear();
    await svc.list({ temImagemGerada: false });
    expect(mock.produto.findMany.mock.calls[0]?.[0].where.AND).toContainEqual({
      imagens: { none: { origem: 'GERADA' } },
    });
  });

  it('temImagens=true + temImagemGerada=false coexistem via AND (fila da skill /gerar-imagem)', async () => {
    // Regressão: spread duplo na chave `imagens` se sobrescrevia (last-wins).
    await svc.list({ temImagens: true, temImagemGerada: false });
    const where = mock.produto.findMany.mock.calls[0]?.[0].where;
    expect(where.AND).toContainEqual({ imagens: { some: {} } });
    expect(where.AND).toContainEqual({ imagens: { none: { origem: 'GERADA' } } });
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
    const svc = new ProdutosService(asPrisma(mock), makeImagensMock(), makeMediaUrlMock());
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
    const svc = new ProdutosService(asPrisma(mock), makeImagensMock(), makeMediaUrlMock());
    const r = await svc.desativarMuitos(['x', 'y', 'z']);
    expect(r).toEqual({ ok: true, count: 3 });
    const call = mock.produto.updateMany.mock.calls[0]?.[0];
    expect(call?.data).toEqual({ ativo: false });
  });
});

describe('ProdutosService.vitrine', () => {
  const linhaBase = {
    id: 'p1',
    nome: 'Polvo Articulado',
    precoCentavos: 2490,
    canalPrincipal: 'SHOPEE',
    variacoes: [{ estoqueAtual: 3, estoqueMinimo: 5 }],
  };

  it('cai no render do MakerWorld quando o produto ainda não tem foto', async () => {
    const { mock } = makePrismaMock();
    mock.produto.findMany.mockResolvedValue([
      { ...linhaBase, imagens: [], modeloMakerWorld: { imagemUrl: 'https://mw/render.png' } },
    ] as never);
    mock.venda.findMany.mockResolvedValue([] as never);
    const svc = new ProdutosService(asPrisma(mock), makeImagensMock(), makeMediaUrlMock());

    const [linha] = await svc.vitrine();

    expect(linha?.imagemUrl).toBe('https://mw/render.png');
    expect(linha?.imagemEhRender).toBe(true);
    // 3 prontos contra mínimo 5 — a vitrine tem que gritar.
    expect(linha?.abaixoDoMinimo).toBe(true);
  });

  it('foto própria ganha do render, e não marca como render', async () => {
    const { mock } = makePrismaMock();
    mock.produto.findMany.mockResolvedValue([
      {
        ...linhaBase,
        imagens: [{ arquivo: 'produtos/p1/foto.jpg' }],
        modeloMakerWorld: { imagemUrl: 'https://mw/render.png' },
      },
    ] as never);
    mock.venda.findMany.mockResolvedValue([] as never);
    const svc = new ProdutosService(asPrisma(mock), makeImagensMock(), makeMediaUrlMock());

    const [linha] = await svc.vitrine();

    expect(linha?.imagemUrl).toBe('https://media.test/produtos/p1/foto.jpg');
    expect(linha?.imagemEhRender).toBe(false);
  });

  it('soma unidades e receita usando o preço praticado em cada venda', async () => {
    const { mock } = makePrismaMock();
    mock.produto.findMany.mockResolvedValue([
      { ...linhaBase, imagens: [], modeloMakerWorld: null },
    ] as never);
    mock.venda.findMany.mockResolvedValue([
      { produtoId: 'p1', qtd: 2, precoUnitarioCentavos: 2490, dataVenda: new Date('2026-07-01') },
      // Preço promocional: se a receita usasse Produto.precoCentavos, sairia inflada.
      { produtoId: 'p1', qtd: 1, precoUnitarioCentavos: 1990, dataVenda: new Date('2026-07-20') },
    ] as never);
    const svc = new ProdutosService(asPrisma(mock), makeImagensMock(), makeMediaUrlMock());

    const [linha] = await svc.vitrine();

    expect(linha?.unidadesVendidas).toBe(3);
    expect(linha?.receitaCentavos).toBe(2 * 2490 + 1990);
    expect(linha?.ultimaVenda).toBe(new Date('2026-07-20').toISOString());
  });
});

describe('ProdutosService.definirCanaisAnunciados — volta pra revisão', () => {
  function montarComModelo(temModelo: boolean) {
    const { mock } = makePrismaMock();
    mock.produto.findUnique.mockResolvedValue({
      id: 'p1',
      modeloMakerWorld: temModelo ? { id: 'm1' } : null,
    });
    const tx = {
      produto: { update: vi.fn().mockImplementation((a: { data: unknown }) => a.data) },
      modeloMakerWorld: { update: vi.fn() },
    };
    mock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (t: unknown) => unknown)(tx),
    );
    const svc = new ProdutosService(asPrisma(mock), makeImagensMock(), makeMediaUrlMock());
    return { svc, tx };
  }

  it('tirar de todos os canais devolve o produto pra fila do MakerWorld', async () => {
    const { svc, tx } = montarComModelo(true);

    await svc.definirCanaisAnunciados('p1', []);

    expect(tx.modeloMakerWorld.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' }, data: { status: 'FAVORITO' } }),
    );
    expect(tx.produto.update.mock.calls[0]?.[0].data).toMatchObject({
      anunciado: false,
      naVitrine: false,
    });
  });

  it('ainda anunciado em algum canal não sai da vitrine', async () => {
    const { svc, tx } = montarComModelo(true);

    await svc.definirCanaisAnunciados('p1', ['SHOPEE']);

    expect(tx.modeloMakerWorld.update).not.toHaveBeenCalled();
    expect(tx.produto.update.mock.calls[0]?.[0].data).not.toHaveProperty('naVitrine');
  });

  it('produto cadastrado à mão não tem pra onde voltar — só desmarca', async () => {
    // Sem modelo de origem, tirar da vitrine deixaria o produto sem tela nenhuma.
    const { svc, tx } = montarComModelo(false);

    await svc.definirCanaisAnunciados('p1', []);

    expect(tx.modeloMakerWorld.update).not.toHaveBeenCalled();
    expect(tx.produto.update.mock.calls[0]?.[0].data).not.toHaveProperty('naVitrine');
  });

  it('grava os canais e liga a flag `anunciado`', async () => {
    const { svc, tx } = montarComModelo(true);

    await svc.definirCanaisAnunciados('p1', ['SHOPEE', 'ML']);

    expect(tx.produto.update.mock.calls[0]?.[0].data).toMatchObject({
      canaisAnunciados: ['SHOPEE', 'ML'],
      anunciado: true,
    });
  });

  it('canal repetido não vira selo duplicado', async () => {
    const { svc, tx } = montarComModelo(true);

    await svc.definirCanaisAnunciados('p1', ['SHOPEE', 'SHOPEE', 'ML']);

    expect(tx.produto.update.mock.calls[0]?.[0].data.canaisAnunciados).toEqual(['SHOPEE', 'ML']);
  });

  it('produto inexistente é 404', async () => {
    const { mock } = makePrismaMock();
    mock.produto.findUnique.mockResolvedValue(null);
    const svc = new ProdutosService(asPrisma(mock), makeImagensMock(), makeMediaUrlMock());

    await expect(svc.definirCanaisAnunciados('fantasma', ['SHOPEE'])).rejects.toThrow(/não existe/);
  });
});
