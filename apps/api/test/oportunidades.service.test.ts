import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import type { OportunidadeCreate } from '@mahou-hub/contracts';
import { OportunidadesService } from '../src/modules/oportunidades/oportunidades.service';
import { asPrisma, makeAuditMock, makePrismaMock } from './helpers/prisma-mock';

function makeService() {
  const { mock, tx } = makePrismaMock();
  const audit = makeAuditMock();
  const service = new OportunidadesService(asPrisma(mock), audit);
  return { service, prisma: mock, tx, audit };
}

const basePayload: OportunidadeCreate = {
  marketplace: 'SHOPEE',
  externalId: '12345',
  productName: 'Porta controle PS5',
  priceMinCentavos: 3500,
  priceMaxCentavos: 4900,
  imageUrl: 'https://img/1.jpg',
  productLink: 'https://shopee/1',
  vendasAfiliadoMes: 1800,
  ratingStar: 4.7,
  categoriaIds: [100012],
  lojaExternalId: '999',
  lojaNome: 'Loja Teste',
  fonte: 'KEYWORD',
  fonteParam: 'porta controle',
};

describe('OportunidadesService.create (upsert por marketplace+externalId)', () => {
  let svc: ReturnType<typeof makeService>;
  beforeEach(() => {
    svc = makeService();
    svc.prisma.produtoOportunidade.upsert.mockResolvedValue({
      id: 'opo1',
      ...basePayload,
      ratingStar: new Prisma.Decimal(4.7),
      score: null,
      status: 'NOVO',
      notas: null,
      produtoId: null,
      concorrenteId: null,
      snapshotProdutoId: null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });
  });

  it('chama upsert com chave composta', async () => {
    await svc.service.create(basePayload);
    const call = svc.prisma.produtoOportunidade.upsert.mock.calls[0]?.[0];
    expect(call?.where).toEqual({
      marketplace_externalId: { marketplace: 'SHOPEE', externalId: '12345' },
    });
  });

  it('preserva status/score/notas no update quando NÃO vêm no payload (workflow stickiness)', async () => {
    await svc.service.create(basePayload); // sem status/score/notas
    const call = svc.prisma.produtoOportunidade.upsert.mock.calls[0]?.[0];
    expect(call?.update).not.toHaveProperty('status');
    expect(call?.update).not.toHaveProperty('score');
    expect(call?.update).not.toHaveProperty('notas');
  });

  it('quando vêm status/score/notas no payload, eles SOBRESCREVEM no update', async () => {
    await svc.service.create({
      ...basePayload,
      status: 'EM_ANALISE',
      score: 87,
      notas: 'analise feita',
    });
    const call = svc.prisma.produtoOportunidade.upsert.mock.calls[0]?.[0];
    expect(call?.update.status).toBe('EM_ANALISE');
    expect((call?.update.score as Prisma.Decimal).toString()).toBe('87');
    expect(call?.update.notas).toBe('analise feita');
  });
});

describe('OportunidadesService.virarProduto', () => {
  let svc: ReturnType<typeof makeService>;
  beforeEach(() => {
    svc = makeService();
    svc.prisma.produtoOportunidade.findUnique.mockResolvedValue({
      id: 'opo1',
      marketplace: 'SHOPEE',
      externalId: '12345',
      productName: 'Porta controle PS5',
      productLink: 'https://shopee/1',
      priceMinCentavos: 3500,
      priceMaxCentavos: 4900,
      produtoId: null,
    });
    svc.tx.produto.create.mockResolvedValue({ id: 'prod1' });
    svc.tx.produtoOportunidade.update.mockResolvedValue({ id: 'opo1' });
  });

  it('cria Produto completo (rascunho=false, ativo=true) quando todos os campos vêm', async () => {
    svc.prisma.filamento.findUnique.mockResolvedValue({ id: 'fil1' });

    await svc.service.virarProduto('opo1', {
      filamentoId: 'fil1',
      pesoG: 25,
      tempoH: 1.5,
      impressora: 'A1',
    });

    const created = svc.tx.produto.create.mock.calls[0]?.[0];
    expect(created?.data.rascunho).toBe(false);
    expect(created?.data.ativo).toBe(true);
    expect(created?.data.filamentoId).toBe('fil1');
    expect((created?.data.pesoG as Prisma.Decimal).toString()).toBe('25');
    expect((created?.data.tempoH as Prisma.Decimal).toString()).toBe('1.5');
    expect(created?.data.impressora).toBe('A1');
    // Pré-preenchimento: nome=productName, preço=média, inspiração=productLink
    expect(created?.data.nome).toBe('Porta controle PS5');
    expect(created?.data.precoCentavos).toBe(4200); // (3500+4900)/2
    expect(created?.data.inspiracao).toBe('https://shopee/1');
    expect(created?.data.canalPrincipal).toBe('SHOPEE');
  });

  it('cria rascunho (ativo=false) quando filamento falta — usa primeiro filamento ativo', async () => {
    svc.prisma.filamento.findFirst.mockResolvedValue({ id: 'fil-fallback' });

    await svc.service.virarProduto('opo1', { pesoG: 25, tempoH: 1.5, impressora: 'A1' });

    const created = svc.tx.produto.create.mock.calls[0]?.[0];
    expect(created?.data.rascunho).toBe(true);
    expect(created?.data.ativo).toBe(false);
    expect(created?.data.filamentoId).toBe('fil-fallback');
  });

  it('cria rascunho com defaults zerados quando peso/tempo/impressora faltam', async () => {
    svc.prisma.filamento.findFirst.mockResolvedValue({ id: 'fil-fallback' });

    await svc.service.virarProduto('opo1', {});

    const created = svc.tx.produto.create.mock.calls[0]?.[0];
    expect(created?.data.rascunho).toBe(true);
    expect((created?.data.pesoG as Prisma.Decimal).toString()).toBe('0');
    expect((created?.data.tempoH as Prisma.Decimal).toString()).toBe('0');
    expect(created?.data.impressora).toBe('A1');
    expect(created?.data.embalagemCentavos).toBe(0);
  });

  it('erro se filamento passado explicitamente não existe', async () => {
    svc.prisma.filamento.findUnique.mockResolvedValue(null);
    await expect(
      svc.service.virarProduto('opo1', { filamentoId: 'fantasma', pesoG: 25, tempoH: 1, impressora: 'A1' }),
    ).rejects.toThrow(/Filamento fantasma não existe/);
  });

  it('erro se rascunho mas nenhum filamento ativo cadastrado', async () => {
    svc.prisma.filamento.findFirst.mockResolvedValue(null);
    await expect(svc.service.virarProduto('opo1', {})).rejects.toThrow(/Nenhum filamento ativo/);
  });

  it('conflict se oportunidade já tem produtoId', async () => {
    svc.prisma.produtoOportunidade.findUnique.mockResolvedValue({
      id: 'opo1',
      productName: 'x',
      productLink: 'x',
      priceMinCentavos: 100,
      priceMaxCentavos: 100,
      marketplace: 'SHOPEE',
      externalId: '1',
      produtoId: 'prod-existente',
    });
    await expect(svc.service.virarProduto('opo1', {})).rejects.toThrow(/já virou produto/);
  });

  it('marca oportunidade VIRARAM_PRODUTO + produtoId no fim', async () => {
    svc.prisma.filamento.findFirst.mockResolvedValue({ id: 'f' });
    await svc.service.virarProduto('opo1', {});
    const update = svc.tx.produtoOportunidade.update.mock.calls[0]?.[0];
    expect(update?.where).toEqual({ id: 'opo1' });
    expect(update?.data).toEqual({ status: 'VIRARAM_PRODUTO', produtoId: 'prod1' });
  });
});
