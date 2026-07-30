import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MakerworldListarSchema, type MakerworldModeloImport } from '@mahou-hub/contracts';
import { MakerworldService } from '../src/modules/makerworld/makerworld.service';
import type { PricingService } from '../src/modules/pricing/pricing.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

// Só `buscarDetalhe` usa o pricing; nos testes de importação e listagem o stub
// existe apenas pra satisfazer o construtor.
function pricingFake(over: Partial<Record<keyof PricingService, unknown>> = {}) {
  return {
    economiaDeCustoPronto: vi.fn(),
    planoAds: vi.fn(),
    ...over,
  } as unknown as PricingService;
}

function modeloFake(over: Partial<MakerworldModeloImport> = {}): MakerworldModeloImport {
  return {
    externalId: '3066629',
    titulo: 'Cobrinha flexível',
    url: 'https://makerworld.com/en/models/3066629-cobrinha',
    autor: 'Fulano',
    imagemUrl: 'https://cdn/img.jpg',
    downloads: 5200,
    curtidas: 300,
    colecoes: 900,
    licenca: 'CC0',
    licencaVeredicto: 'LIVRE',
    licencaObrigacao: 'Domínio público.',
    nicho: 'FLEXI_ARTICULADO',
    pesoGramas: 42.5,
    tempoHoras: 2.75,
    unidadesPorKit: 1,
    custoEstimadoCentavos: 560,
    precoSugeridoCentavos: 3990,
    margemEstimadaPct: 52.3,
    lucroPorHoraCentavos: 760,
    scoreObjetivo: 88,
    notaIa: 91,
    veredictoIa: 'APROVADO',
    justificativaIa: 'Flexi com apelo imediato e impressão rápida.',
    alertas: [],
    tags: ['flexi', 'cobra'],
    temFotoReal: true,
    ...over,
  };
}

describe('MakerworldService', () => {
  it('importarEmLote conta criados e atualizados pelo externalId', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique
      .mockResolvedValueOnce(null) // primeiro é novo
      .mockResolvedValueOnce({ id: 'm1' }); // segundo já existia
    mock.modeloMakerWorld.upsert.mockResolvedValue({});
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    const r = await svc.importarEmLote({
      modelos: [modeloFake(), modeloFake({ externalId: '999' })],
    });

    expect(r).toEqual({ criados: 1, atualizados: 1, total: 2 });
  });

  it('importarEmLote converte peso, tempo e margem para Decimal do Prisma', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue(null);
    mock.modeloMakerWorld.upsert.mockResolvedValue({});
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await svc.importarEmLote({ modelos: [modeloFake()] });

    const args = mock.modeloMakerWorld.upsert.mock.calls[0]?.[0];
    expect(args.create.pesoGramas.toString()).toBe('42.5');
    expect(args.create.tempoHoras.toString()).toBe('2.75');
    expect(args.create.margemEstimadaPct.toString()).toBe('52.3');
  });

  // Regressão: reimportar não pode desfazer a revisão do Gabriel. Se o update carregasse
  // `status`, um modelo que ele descartou voltaria pra NOVO na varredura seguinte.
  it('importarEmLote não sobrescreve status nem observacao no update', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue({ id: 'm1' });
    mock.modeloMakerWorld.upsert.mockResolvedValue({});
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await svc.importarEmLote({ modelos: [modeloFake()] });

    const args = mock.modeloMakerWorld.upsert.mock.calls[0]?.[0];
    expect(args.update).not.toHaveProperty('status');
    expect(args.update).not.toHaveProperty('observacao');
  });

  it('listar com semAlertas monta NOT/hasSome pra esconder risco de marca', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findMany.mockResolvedValue([]);
    mock.modeloMakerWorld.count.mockResolvedValue(0);
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await svc.listar({
      semAlertas: ['IP_TERCEIRO'],
      ordenarPor: 'notaIa',
      limit: 50,
      offset: 0,
    });

    const where = mock.modeloMakerWorld.findMany.mock.calls[0]?.[0].where;
    expect(where.NOT).toEqual({ alertas: { hasSome: ['IP_TERCEIRO'] } });
  });

  it('listar por lucroPorHora ordena pelo campo certo', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findMany.mockResolvedValue([]);
    mock.modeloMakerWorld.count.mockResolvedValue(0);
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await svc.listar({ ordenarPor: 'lucroPorHora', limit: 10, offset: 0 });

    expect(mock.modeloMakerWorld.findMany.mock.calls[0]?.[0].orderBy).toEqual([
      { lucroPorHoraCentavos: 'desc' },
    ]);
  });

  // Regressão: a tela manda `?semAlertas=IP_TERCEIRO` sozinho, que chega como string.
  // Sem o preprocess no schema o Zod rejeitava com "Expected array, received string"
  // e a listagem inteira voltava vazia.
  it('MakerworldListarSchema aceita semAlertas como string única', () => {
    const r = MakerworldListarSchema.parse({ semAlertas: 'IP_TERCEIRO' });
    expect(r.semAlertas).toEqual(['IP_TERCEIRO']);
  });

  it('MakerworldListarSchema mantém semAlertas quando já vem array', () => {
    const r = MakerworldListarSchema.parse({ semAlertas: ['IP_TERCEIRO', 'FRAGIL'] });
    expect(r.semAlertas).toEqual(['IP_TERCEIRO', 'FRAGIL']);
  });

  it('buscarPorId lança NotFound quando o modelo não existe', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue(null);
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await expect(svc.buscarPorId('sumiu')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resumo agrega por nicho com nota média arredondada', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.groupBy
      .mockResolvedValueOnce([
        { nicho: 'FLEXI_ARTICULADO', _count: { _all: 12 }, _avg: { notaIa: 78.6 } },
      ])
      .mockResolvedValueOnce([{ status: 'NOVO', _count: { _all: 12 } }]);
    mock.modeloMakerWorld.count.mockResolvedValue(12);
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    const r = await svc.resumo();

    expect(r.porNicho[0]).toEqual({
      nicho: 'FLEXI_ARTICULADO',
      quantidade: 12,
      notaMedia: 79,
    });
    expect(r.total).toBe(12);
  });

  it('buscarDetalhe alimenta o plano de ROAS com o líquido calculado, não com o preço', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue({
      id: 'm1',
      precoSugeridoCentavos: 2490,
      custoEstimadoCentavos: 377,
      tempoHoras: '2.28',
      anuncios: [],
    });
    const economia = { canal: 'SHOPEE', precoCentavos: 2490, liquidoCentavos: 1120 };
    const pricing = pricingFake({
      economiaDeCustoPronto: vi.fn().mockResolvedValue(economia),
      planoAds: vi.fn().mockResolvedValue({ inviavel: false, roasBreakeven: 2.22 }),
    });
    const svc = new MakerworldService(asPrisma(mock), pricing);

    const r = await svc.buscarDetalhe('m1');

    expect(pricing.economiaDeCustoPronto).toHaveBeenCalledWith({
      precoCentavos: 2490,
      custoCentavos: 377,
      canal: 'SHOPEE',
      tempoHoras: 2.28,
    });
    // O erro clássico é mandar o preço como margem de contribuição — o ROAS sairia
    // otimista e o teste de anúncio aprovaria produto que não paga o clique.
    expect(pricing.planoAds).toHaveBeenCalledWith({
      precoCentavos: 2490,
      margemContribuicaoCentavos: 1120,
    });
    expect(r.economia).toBe(economia);
  });

  it('buscarDetalhe lança NotFound sem chamar o pricing', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue(null);
    const pricing = pricingFake();
    const svc = new MakerworldService(asPrisma(mock), pricing);

    await expect(svc.buscarDetalhe('sumiu')).rejects.toBeInstanceOf(NotFoundException);
    expect(pricing.economiaDeCustoPronto).not.toHaveBeenCalled();
  });

  it('marcarAnunciado não cria produto duplicado quando o modelo já virou produto', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue({ id: 'm1', produtoId: 'p1', anuncios: [] });
    mock.produto.update.mockResolvedValue({ id: 'p1', naVitrine: true });
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await svc.marcarAnunciado('m1', ['SHOPEE', 'ML']);

    expect(mock.produto.create).not.toHaveBeenCalled();
    expect(mock.produto.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { anunciado: true, canaisAnunciados: ['SHOPEE', 'ML'], naVitrine: true },
    });
  });

  it('marcarAnunciado usa o título do anúncio Shopee como nome do produto', async () => {
    const { mock, tx } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue({
      id: 'm1',
      produtoId: null,
      titulo: 'Articulated Octopus – Commercial use allowed',
      url: 'https://makerworld.com/models/1',
      pesoGramas: '24',
      tempoHoras: '2.28',
      precoSugeridoCentavos: 2490,
      anuncios: [{ titulo: 'Polvo Articulado Flexivel Impressao 3D', precoBaseCentavos: 1990 }],
    });
    mock.filamento.findFirst.mockResolvedValue({ id: 'fil1' });
    tx.produto.create.mockResolvedValue({ id: 'p9' });
    tx.modeloMakerWorld.update.mockResolvedValue({});
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await svc.marcarAnunciado('m1');

    const data = tx.produto.create.mock.calls[0]![0].data;
    // O título do MakerWorld está em inglês; quem vale é o nome sob o qual o produto
    // está de fato à venda.
    expect(data.nome).toBe('Polvo Articulado Flexivel Impressao 3D');
    expect(data.precoCentavos).toBe(1990);
    expect(data.naVitrine).toBe(true);
    expect(data.anunciado).toBe(true);
  });

  it('salvarAnuncio começa na versão 1 e incrementa ao regerar o mesmo marketplace', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue({ id: 'm1' });
    mock.anuncioModelo.findUnique.mockResolvedValue({ versao: 2 });
    mock.anuncioModelo.upsert.mockResolvedValue({});
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await svc.salvarAnuncio('m1', {
      marketplace: 'SHOPEE',
      titulo: 'Polvo Articulado',
      descricao: 'Impresso em 3D.',
      tags: ['polvo'],
      categoria: 'Casa e Decoração > Decoração',
      categoriaId: null,
      fichaTecnica: [],
      precoBaseCentavos: 2490,
    });

    const args = mock.anuncioModelo.upsert.mock.calls[0]![0];
    expect(args.create.versao).toBeUndefined(); // default do banco = 1
    expect(args.update.versao).toBe(3);
    expect(args.where).toEqual({
      modeloId_marketplace: { modeloId: 'm1', marketplace: 'SHOPEE' },
    });
  });
});

describe('MakerworldService.marcarAnunciado — canais', () => {
  it('sem canais informados ainda marca anunciado', async () => {
    // O Gabriel disse que anunciou, só não disse onde. Tratar como "não anunciado"
    // jogaria o produto de volta na fila de geração de foto do fluxo externo.
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue({ id: 'm1', produtoId: 'p1', anuncios: [] });
    mock.produto.update.mockResolvedValue({ id: 'p1' });
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await svc.marcarAnunciado('m1');

    expect(mock.produto.update.mock.calls[0]?.[0].data).toMatchObject({
      anunciado: true,
      canaisAnunciados: [],
    });
  });

  it('canal repetido não duplica', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue({ id: 'm1', produtoId: 'p1', anuncios: [] });
    mock.produto.update.mockResolvedValue({ id: 'p1' });
    const svc = new MakerworldService(asPrisma(mock), pricingFake());

    await svc.marcarAnunciado('m1', ['SHOPEE', 'SHOPEE']);

    expect(mock.produto.update.mock.calls[0]?.[0].data.canaisAnunciados).toEqual(['SHOPEE']);
  });
});
