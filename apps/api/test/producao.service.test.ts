import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import type { JobCreate } from '@mahou-hub/contracts';
import { ProducaoService } from '../src/modules/producao/producao.service';
import type { EstoqueService } from '../src/modules/estoque/estoque.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

function makeEstoqueMock() {
  return {
    registrarMovimento: vi.fn().mockResolvedValue({}),
  } as unknown as EstoqueService & { registrarMovimento: ReturnType<typeof vi.fn> };
}

function item(over: Partial<JobCreate> = {}): JobCreate {
  return {
    dataInicio: '2026-06-16T00:00:00.000Z',
    origem: 'SHOPEE',
    produtoId: 'p1',
    variacaoId: null,
    qtd: 1,
    prioridade: 0,
    impressora: 'A1',
    observacao: null,
    ...over,
  } as JobCreate;
}

describe('ProducaoService.createMany — split estoque de prontos × imprimir', () => {
  it('divide entre estoque (pula impressão) e fila quando o estoque cobre parte', async () => {
    const { mock, tx } = makePrismaMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({ estoqueAtual: 4 });
    tx.jobProducao.createMany.mockResolvedValue({ count: 2 });
    const svc = new ProducaoService(asPrisma(mock), makeEstoqueMock());

    await svc.createMany([item({ variacaoId: 'v1', qtd: 10 })]);

    expect(tx.jobProducao.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ variacaoId: 'v1', qtd: 4, daEstoque: true, status: 'CONCLUIDO' }),
        expect.objectContaining({ variacaoId: 'v1', qtd: 6, status: 'FILA' }),
      ],
    });
  });

  it('quando o estoque cobre tudo, cria só o card do estoque (nada na fila)', async () => {
    const { mock, tx } = makePrismaMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({ estoqueAtual: 10 });
    tx.jobProducao.createMany.mockResolvedValue({ count: 1 });
    const svc = new ProducaoService(asPrisma(mock), makeEstoqueMock());

    await svc.createMany([item({ variacaoId: 'v1', qtd: 4 })]);

    expect(tx.jobProducao.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ qtd: 4, daEstoque: true, status: 'CONCLUIDO' })],
    });
  });

  it('sem estoque, cria só o card da fila (imprimir)', async () => {
    const { mock, tx } = makePrismaMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({ estoqueAtual: 0 });
    tx.jobProducao.createMany.mockResolvedValue({ count: 1 });
    const svc = new ProducaoService(asPrisma(mock), makeEstoqueMock());

    await svc.createMany([item({ variacaoId: 'v1', qtd: 5 })]);

    expect(tx.jobProducao.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ variacaoId: 'v1', qtd: 5, status: 'FILA' })],
    });
  });

  it('estoque negativo é tratado como 0 (não cria card do estoque negativo)', async () => {
    const { mock, tx } = makePrismaMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({ estoqueAtual: -3 });
    tx.jobProducao.createMany.mockResolvedValue({ count: 1 });
    const svc = new ProducaoService(asPrisma(mock), makeEstoqueMock());

    await svc.createMany([item({ variacaoId: 'v1', qtd: 5 })]);

    expect(tx.jobProducao.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ qtd: 5, status: 'FILA' })],
    });
  });

  it('item sem variação vira 1 card normal (não consulta estoque de prontos)', async () => {
    const { mock, tx } = makePrismaMock();
    tx.jobProducao.createMany.mockResolvedValue({ count: 1 });
    const svc = new ProducaoService(asPrisma(mock), makeEstoqueMock());

    await svc.createMany([item({ variacaoId: null, qtd: 3 })]);

    expect(tx.produtoVariacao.findUnique).not.toHaveBeenCalled();
    expect(tx.jobProducao.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ qtd: 3, status: 'FILA', variacaoId: null })],
    });
  });
});

describe('ProducaoService.mudarStatus — filamento e estoque de prontos', () => {
  it('CONCLUIDO num card normal baixa filamento (peso×qtd) permitindo negativo', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1', qtd: 3, status: 'IMPRIMINDO', daEstoque: false, consumoRegistrado: false,
      consumoProdutoRegistrado: false, variacaoId: null, dataFim: null,
      produto: { nome: 'Suporte', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
      variacao: null,
    });
    mock.jobProducao.update.mockResolvedValue({ id: 'j1' });
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'CONCLUIDO');

    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoItem: 'FILAMENTO',
        filamentoId: 'f1',
        quantidade: -360,
        motivo: 'PRODUCAO',
      }),
      { permitirNegativo: true },
    );
    expect(mock.jobProducao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ consumoRegistrado: true, status: 'CONCLUIDO' }),
      }),
    );
  });

  it('usa o filamento da VARIAÇÃO quando há override de cor', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1', qtd: 2, status: 'IMPRIMINDO', daEstoque: false, consumoRegistrado: false,
      consumoProdutoRegistrado: false, variacaoId: 'v1', dataFim: null,
      produto: { nome: 'Suporte', pesoG: new Prisma.Decimal(100), filamentoId: 'f1' },
      variacao: { nome: 'Rosa', filamentoId: 'fr' },
    });
    mock.jobProducao.update.mockResolvedValue({});
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'CONCLUIDO');

    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({ tipoItem: 'FILAMENTO', filamentoId: 'fr', quantidade: -200 }),
      { permitirNegativo: true },
    );
  });

  it('card do estoque NUNCA baixa filamento (blindagem daEstoque)', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1', qtd: 5, status: 'CONCLUIDO', daEstoque: true, consumoRegistrado: false,
      consumoProdutoRegistrado: false, variacaoId: 'v1', dataFim: null,
      produto: { nome: 'Suporte', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
      variacao: { nome: 'Branco', filamentoId: null },
    });
    mock.jobProducao.update.mockResolvedValue({});
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'CONCLUIDO');

    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
  });

  it('embalar um card do estoque baixa prontos (−qtd, VENDA) e é idempotente', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1', qtd: 5, status: 'CONCLUIDO', daEstoque: true, consumoRegistrado: false,
      consumoProdutoRegistrado: false, variacaoId: 'v1', dataFim: new Date(),
      produto: { nome: 'Suporte', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
      variacao: { nome: 'Rosa', filamentoId: 'fr' },
    });
    mock.jobProducao.update.mockResolvedValue({});
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'EMBALADO');

    expect(estoque.registrarMovimento).toHaveBeenCalledTimes(1);
    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoItem: 'PRODUTO',
        variacaoId: 'v1',
        quantidade: -5,
        motivo: 'VENDA',
      }),
      { permitirNegativo: true },
    );
    expect(mock.jobProducao.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ consumoProdutoRegistrado: true }) }),
    );
  });

  it('já embalado (flag true) não baixa prontos de novo ao ir pra ENVIADO', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1', qtd: 5, status: 'EMBALADO', daEstoque: true, consumoRegistrado: false,
      consumoProdutoRegistrado: true, variacaoId: 'v1', dataFim: new Date(),
      produto: { nome: 'X', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
      variacao: { nome: 'Rosa', filamentoId: 'fr' },
    });
    mock.jobProducao.update.mockResolvedValue({});
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'ENVIADO');

    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
  });

  it('voltar de EMBALADO estorna prontos (+qtd, AJUSTE) e zera a flag', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1', qtd: 5, status: 'EMBALADO', daEstoque: true, consumoRegistrado: false,
      consumoProdutoRegistrado: true, variacaoId: 'v1', dataFim: new Date(),
      produto: { nome: 'X', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
      variacao: { nome: 'Rosa', filamentoId: 'fr' },
    });
    mock.jobProducao.update.mockResolvedValue({});
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'CONCLUIDO');

    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoItem: 'PRODUTO',
        variacaoId: 'v1',
        quantidade: 5,
        motivo: 'AJUSTE',
      }),
      { permitirNegativo: true },
    );
    expect(mock.jobProducao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ consumoProdutoRegistrado: false }),
      }),
    );
  });

  it('mudar pra IMPRIMINDO não mexe no estoque', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1', qtd: 3, status: 'FILA', daEstoque: false, consumoRegistrado: false,
      consumoProdutoRegistrado: false, variacaoId: null, dataFim: null,
      produto: { nome: 'X', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
      variacao: null,
    });
    mock.jobProducao.update.mockResolvedValue({});
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'IMPRIMINDO');

    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
  });
});

describe('ProducaoService.remove — estornos ao excluir', () => {
  it('estorna o filamento quando o consumo de impressão já tinha sido registrado', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1', qtd: 3, consumoRegistrado: true, consumoProdutoRegistrado: false,
      daEstoque: false, variacaoId: null,
      produto: { nome: 'Suporte', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
      variacao: null,
    });
    mock.jobProducao.delete.mockResolvedValue({ id: 'j1' });
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    const res = await svc.remove('j1');

    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({ tipoItem: 'FILAMENTO', filamentoId: 'f1', quantidade: 360 }),
      { permitirNegativo: true },
    );
    expect(res).toEqual({ ok: true, estornado: true, gramas: 360, prontosEstornados: 0 });
  });

  it('estorna o estoque de prontos quando o card do estoque já tinha sido embalado', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1', qtd: 5, consumoRegistrado: false, consumoProdutoRegistrado: true,
      daEstoque: true, variacaoId: 'v1',
      produto: { nome: 'Suporte', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
      variacao: { nome: 'Rosa', filamentoId: 'fr' },
    });
    mock.jobProducao.delete.mockResolvedValue({ id: 'j1' });
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    const res = await svc.remove('j1');

    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoItem: 'PRODUTO',
        variacaoId: 'v1',
        quantidade: 5,
        motivo: 'AJUSTE',
      }),
      { permitirNegativo: true },
    );
    expect(res).toEqual({ ok: true, estornado: false, gramas: 0, prontosEstornados: 5 });
  });

  it('não estorna nada quando o job nunca movimentou estoque', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j2', qtd: 2, consumoRegistrado: false, consumoProdutoRegistrado: false,
      daEstoque: false, variacaoId: null,
      produto: { nome: 'X', pesoG: new Prisma.Decimal(50), filamentoId: 'f1' },
      variacao: null,
    });
    mock.jobProducao.delete.mockResolvedValue({ id: 'j2' });
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    const res = await svc.remove('j2');

    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, estornado: false, gramas: 0, prontosEstornados: 0 });
  });
});
