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
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    produtoVariacao: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
    movimentoEstoque: { create: vi.fn().mockResolvedValue({}) },
    jobProducao: { create: vi.fn().mockResolvedValue({ id: 'job1' }) },
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
