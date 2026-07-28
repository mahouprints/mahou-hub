import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { AtendimentoService, type PedidoImportado } from '../src/modules/pedidos/atendimento.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Mock focado no fluxo de atendimento. `$transaction` executa o callback com o próprio
 * mock — o que importa nos testes é quais escritas foram feitas, não o isolamento real.
 */
function makeMock(overrides: Record<string, unknown> = {}) {
  const tx = {
    pedidoMarketplace: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'ped1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    pedidoItem: {
      create: vi.fn().mockResolvedValue({ id: 'it1' }),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    produtoVariacao: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    movimentoEstoque: { create: vi.fn().mockResolvedValue({}) },
    jobProducao: {
      create: vi.fn().mockResolvedValue({ id: 'job1' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  };
  const mock = { ...tx, $transaction: vi.fn(async (cb: never) => (cb as never as (t: unknown) => unknown)(tx)) };
  return { mock, tx };
}

function pedidoFake(over: Partial<PedidoImportado> = {}): PedidoImportado {
  return {
    canal: 'SHOPEE',
    externalId: '2506AB123',
    statusExterno: 'READY_TO_SHIP',
    compradorNome: 'comprador',
    totalCentavos: 7490,
    prazoEnvio: new Date(Date.now() + 96 * 3_600_000),
    dataPedido: new Date(),
    itens: [
      { skuExterno: 'MOB-BRANCO', nomeExterno: 'Suporte de Móbile', qtd: 1, precoUnitarioCentavos: 7490 },
    ],
    ...over,
  };
}

describe('AtendimentoService', () => {
  it('baixa do estoque quando há peça pronta', async () => {
    const { mock, tx } = makeMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({
      id: 'v1', produtoId: 'p1', estoqueAtual: 5, nome: 'Branco',
    });
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake());

    expect(r.itensAtendidos).toBe(1);
    expect(tx.produtoVariacao.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { estoqueAtual: 4 },
    });
    expect(tx.jobProducao.create).not.toHaveBeenCalled();
    const mov = tx.movimentoEstoque.create.mock.calls[0]?.[0].data;
    expect(mov.motivo).toBe('VENDA');
    expect(Number(mov.quantidade)).toBe(-1);
    expect(Number(mov.saldoApos)).toBe(4);
  });

  it('cria job de produção quando não há peça pronta', async () => {
    const { mock, tx } = makeMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({
      id: 'v1', produtoId: 'p1', estoqueAtual: 0, nome: 'Branco',
    });
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake());

    expect(r.itensAtendidos).toBe(1);
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    const job = tx.jobProducao.create.mock.calls[0]?.[0].data;
    expect(job.produtoId).toBe('p1');
    expect(job.variacaoId).toBe('v1');
    expect(job.status).toBe('FILA');
    // daEstoque não pode ser true: a peça vai ser impressa, e é isso que dispara
    // a baixa de filamento quando o card for concluído.
    expect(job.daEstoque).toBeUndefined();
  });

  // Regressão: estoque parcial não pode virar baixa parcial silenciosa. Pedido de 3
  // com 2 em estoque tem que ir INTEIRO pra produção, senão o saldo mente e falta peça.
  it('estoque insuficiente vai inteiro pra produção, sem baixa parcial', async () => {
    const { mock, tx } = makeMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({
      id: 'v1', produtoId: 'p1', estoqueAtual: 2, nome: 'Branco',
    });
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.importar(
      pedidoFake({
        itens: [{ skuExterno: 'MOB-BRANCO', nomeExterno: 'x', qtd: 3, precoUnitarioCentavos: 100 }],
      }),
    );

    expect(tx.produtoVariacao.update).not.toHaveBeenCalled();
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(tx.jobProducao.create.mock.calls[0]?.[0].data.qtd).toBe(3);
  });

  it('SKU desconhecido deixa o item sem vínculo e bloqueia o pedido', async () => {
    const { mock, tx } = makeMock();
    tx.produtoVariacao.findUnique.mockResolvedValue(null);
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake());

    expect(r.itensSemVinculo).toBe(1);
    expect(tx.pedidoItem.create.mock.calls[0]?.[0].data.atendimento).toBe('SEM_VINCULO');
    const update = tx.pedidoMarketplace.update.mock.calls[0]?.[0].data;
    expect(update.status).toBe('BLOQUEADO');
    expect(update.observacao).toContain('sem vínculo');
    // Nada de estoque tocado — vincular errado baixaria o produto errado.
    expect(tx.produtoVariacao.update).not.toHaveBeenCalled();
    expect(tx.jobProducao.create).not.toHaveBeenCalled();
  });

  // Regressão: o cron reimporta a mesma janela a cada 30 min. Sem essa guarda,
  // cada passada baixaria estoque de novo pelo mesmo pedido.
  it('reimportar pedido existente não baixa estoque de novo', async () => {
    const { mock, tx } = makeMock();
    mock.pedidoMarketplace.findUnique.mockResolvedValue({ id: 'ped1', status: 'ATENDIDO' });
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake());

    expect(r.novo).toBe(false);
    expect(mock.$transaction).not.toHaveBeenCalled();
    expect(tx.produtoVariacao.update).not.toHaveBeenCalled();
    expect(tx.jobProducao.create).not.toHaveBeenCalled();
  });

  it('prazo apertado entra na fila com prioridade alta', async () => {
    const { mock, tx } = makeMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({
      id: 'v1', produtoId: 'p1', estoqueAtual: 0, nome: 'Branco',
    });
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.importar(pedidoFake({ prazoEnvio: new Date(Date.now() + 6 * 3_600_000) }));
    expect(tx.jobProducao.create.mock.calls[0]?.[0].data.prioridade).toBe(100);
  });

  it('sem prazo informado o card não fura a fila', async () => {
    const { mock, tx } = makeMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({
      id: 'v1', produtoId: 'p1', estoqueAtual: 0, nome: 'Branco',
    });
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.importar(pedidoFake({ prazoEnvio: null }));
    expect(tx.jobProducao.create.mock.calls[0]?.[0].data.prioridade).toBe(0);
  });

  it('pedido com vários itens conta atendidos e órfãos separadamente', async () => {
    const { mock, tx } = makeMock();
    tx.produtoVariacao.findUnique
      .mockResolvedValueOnce({ id: 'v1', produtoId: 'p1', estoqueAtual: 9, nome: 'A' })
      .mockResolvedValueOnce(null);
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(
      pedidoFake({
        itens: [
          { skuExterno: 'A', nomeExterno: 'A', qtd: 1, precoUnitarioCentavos: 100 },
          { skuExterno: 'DESCONHECIDO', nomeExterno: 'B', qtd: 1, precoUnitarioCentavos: 100 },
        ],
      }),
    );

    expect(r.itensAtendidos).toBe(1);
    expect(r.itensSemVinculo).toBe(1);
    expect(tx.pedidoMarketplace.update.mock.calls[0]?.[0].data.status).toBe('BLOQUEADO');
  });
});

describe('AtendimentoService — status vindo do marketplace', () => {
  function mockComPedidoExistente(statusAtual = 'ATENDIDO') {
    const { mock, tx } = makeMock();
    mock.pedidoMarketplace.findUnique.mockResolvedValue({ id: 'ped1', status: statusAtual });
    mock.pedidoItem.findMany.mockResolvedValue([{ jobProducaoId: 'job1' }]);
    mock.jobProducao.updateMany.mockResolvedValue({ count: 1 });
    return { mock, tx };
  }

  it('SHIPPED na Shopee marca o pedido como ENVIADO', async () => {
    const { mock } = mockComPedidoExistente();
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake({ statusExterno: 'SHIPPED' }));

    expect(r.statusAtualizado).toBe('ENVIADO');
    expect(mock.pedidoMarketplace.update.mock.calls[0]?.[0].data.status).toBe('ENVIADO');
  });

  // PROCESSED é quando o vendedor gerou a etiqueta — na prática a peça já saiu da
  // bancada, então conta como enviado pro controle de produção.
  it('PROCESSED também conta como ENVIADO', async () => {
    const { mock } = mockComPedidoExistente();
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake({ statusExterno: 'PROCESSED' }));
    expect(r.statusAtualizado).toBe('ENVIADO');
  });

  it('CANCELLED marca como CANCELADO', async () => {
    const { mock } = mockComPedidoExistente();
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake({ statusExterno: 'CANCELLED' }));
    expect(r.statusAtualizado).toBe('CANCELADO');
  });

  it('pedido enviado fecha os cards de produção abertos', async () => {
    const { mock } = mockComPedidoExistente();
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.importar(pedidoFake({ statusExterno: 'SHIPPED' }));

    const args = mock.jobProducao.updateMany.mock.calls[0]?.[0];
    expect(args.data.status).toBe('ENVIADO');
    // Card já embalado/enviado manualmente não é reescrito — preserva o histórico.
    expect(args.where.status.in).toEqual(['FILA', 'IMPRIMINDO', 'CONCLUIDO']);
  });

  it('READY_TO_SHIP não muda o status interno', async () => {
    const { mock } = mockComPedidoExistente();
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake({ statusExterno: 'READY_TO_SHIP' }));

    expect(r.statusAtualizado).toBeNull();
    expect(mock.jobProducao.updateMany).not.toHaveBeenCalled();
  });

  // Regressão: a Shopee acrescenta status novos sem aviso. Um desconhecido não pode
  // reverter um pedido já ENVIADO pra outro estado.
  it('status desconhecido não regride o pedido', async () => {
    const { mock } = mockComPedidoExistente('ENVIADO');
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake({ statusExterno: 'STATUS_QUE_NAO_EXISTE' }));

    expect(r.statusAtualizado).toBeNull();
    expect(mock.pedidoMarketplace.update.mock.calls[0]?.[0].data.status).toBeUndefined();
  });

  it('reenviar o mesmo status não refaz o trabalho', async () => {
    const { mock } = mockComPedidoExistente('ENVIADO');
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake({ statusExterno: 'SHIPPED' }));

    expect(r.statusAtualizado).toBeNull();
    expect(mock.jobProducao.updateMany).not.toHaveBeenCalled();
  });

  it('shipped do Mercado Livre também marca ENVIADO', async () => {
    const { mock } = mockComPedidoExistente();
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.importar(pedidoFake({ canal: 'ML', statusExterno: 'shipped' }));
    expect(r.statusAtualizado).toBe('ENVIADO');
  });
});
