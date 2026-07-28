import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MakerworldListarSchema, type MakerworldModeloImport } from '@mahou-hub/contracts';
import { MakerworldService } from '../src/modules/makerworld/makerworld.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

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
    const svc = new MakerworldService(asPrisma(mock));

    const r = await svc.importarEmLote({
      modelos: [modeloFake(), modeloFake({ externalId: '999' })],
    });

    expect(r).toEqual({ criados: 1, atualizados: 1, total: 2 });
  });

  it('importarEmLote converte peso, tempo e margem para Decimal do Prisma', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findUnique.mockResolvedValue(null);
    mock.modeloMakerWorld.upsert.mockResolvedValue({});
    const svc = new MakerworldService(asPrisma(mock));

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
    const svc = new MakerworldService(asPrisma(mock));

    await svc.importarEmLote({ modelos: [modeloFake()] });

    const args = mock.modeloMakerWorld.upsert.mock.calls[0]?.[0];
    expect(args.update).not.toHaveProperty('status');
    expect(args.update).not.toHaveProperty('observacao');
  });

  it('listar com semAlertas monta NOT/hasSome pra esconder risco de marca', async () => {
    const { mock } = makePrismaMock();
    mock.modeloMakerWorld.findMany.mockResolvedValue([]);
    mock.modeloMakerWorld.count.mockResolvedValue(0);
    const svc = new MakerworldService(asPrisma(mock));

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
    const svc = new MakerworldService(asPrisma(mock));

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
    const svc = new MakerworldService(asPrisma(mock));

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
    const svc = new MakerworldService(asPrisma(mock));

    const r = await svc.resumo();

    expect(r.porNicho[0]).toEqual({
      nicho: 'FLEXI_ARTICULADO',
      quantidade: 12,
      notaMedia: 79,
    });
    expect(r.total).toBe(12);
  });
});
