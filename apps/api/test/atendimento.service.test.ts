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
    venda: { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
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

describe('AtendimentoService.vincularItem — o botão "vincular a uma variação"', () => {
  const ITEM_ORFAO = {
    id: 'it-orfao',
    pedidoId: 'ped1',
    skuExterno: 'SKU-QUE-NINGUEM-CONHECE',
    nomeExterno: 'Polvo azul',
    qtd: 2,
    precoUnitarioCentavos: 3990,
    pedido: { canal: 'SHOPEE', externalId: '2506AB123', prazoEnvio: null },
  };

  function mockComOrfao(variacao: Record<string, unknown> | null) {
    const { mock, tx } = makeMock();
    mock.pedidoItem.findUnique.mockResolvedValue(ITEM_ORFAO);
    // Busca por id (o vínculo escolhido) devolve a variação; por sku não devolve nada —
    // que é justamente a situação de um item órfão.
    tx.produtoVariacao.findUnique.mockImplementation((args: { where: { id?: string } }) =>
      Promise.resolve(args.where.id ? variacao : null),
    );
    return { mock, tx };
  }

  it('REGRESSÃO: vincula de verdade em vez de recriar o item órfão', async () => {
    // O bug: atendia pelo skuExterno (que já tinha falhado), criava outra linha
    // SEM_VINCULO e apagava a que acabara de ser vinculada. O pedido continuava travado.
    const { mock, tx } = mockComOrfao({
      id: 'v1',
      produtoId: 'p1',
      estoqueAtual: 5,
      nome: 'Azul',
    });
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.vincularItem('it-orfao', 'v1');

    expect(r.atendimento).toBe('BAIXADO_ESTOQUE');
    const criados = tx.pedidoItem.create.mock.calls.map((c) => c[0].data);
    expect(criados).toHaveLength(1);
    expect(criados[0]?.atendimento).toBe('BAIXADO_ESTOQUE');
    expect(criados[0]?.variacaoId).toBe('v1');
    expect(criados.some((d) => d.atendimento === 'SEM_VINCULO')).toBe(false);
  });

  it('baixa o estoque da variação escolhida', async () => {
    const { mock, tx } = mockComOrfao({ id: 'v1', produtoId: 'p1', estoqueAtual: 5, nome: 'Azul' });
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.vincularItem('it-orfao', 'v1');

    expect(tx.produtoVariacao.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v1' }, data: { estoqueAtual: 3 } }),
    );
    expect(tx.movimentoEstoque.create.mock.calls[0]?.[0].data.motivo).toBe('VENDA');
  });

  it('sem peça pronta, manda pra fila de produção na cor certa', async () => {
    const { mock, tx } = mockComOrfao({ id: 'v1', produtoId: 'p1', estoqueAtual: 0, nome: 'Azul' });
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.vincularItem('it-orfao', 'v1');

    expect(r.atendimento).toBe('EM_PRODUCAO');
    expect(tx.jobProducao.create.mock.calls[0]?.[0].data).toMatchObject({
      produtoId: 'p1',
      variacaoId: 'v1',
      qtd: 2,
    });
  });

  it('desatravanca o pedido quando não sobra nenhum item órfão', async () => {
    const { mock, tx } = mockComOrfao({ id: 'v1', produtoId: 'p1', estoqueAtual: 5, nome: 'Azul' });
    tx.pedidoItem.count.mockResolvedValue(0);
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.vincularItem('it-orfao', 'v1');

    expect(tx.pedidoMarketplace.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ATENDIDO', observacao: null } }),
    );
  });

  it('mantém o pedido bloqueado enquanto sobrar item sem vínculo', async () => {
    const { mock, tx } = mockComOrfao({ id: 'v1', produtoId: 'p1', estoqueAtual: 5, nome: 'Azul' });
    tx.pedidoItem.count.mockResolvedValue(1);
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    const r = await svc.vincularItem('it-orfao', 'v1');

    expect(r.restamOrfaos).toBe(1);
    expect(tx.pedidoMarketplace.update).not.toHaveBeenCalled();
  });

  it('recusa vincular a uma variação que não existe', async () => {
    const { mock } = mockComOrfao(null);
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await expect(svc.vincularItem('it-orfao', 'fantasma')).rejects.toThrow(/não existe/);
  });
});

describe('AtendimentoService — pedido de marketplace vira Venda', () => {
  function mockComVariacao(estoque: number) {
    const { mock, tx } = makeMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({
      id: 'v1',
      produtoId: 'p1',
      estoqueAtual: estoque,
      nome: 'Azul',
    });
    tx.pedidoItem.create.mockResolvedValue({ id: 'item-novo' });
    return { mock, tx };
  }

  it('item atendido do estoque gera venda com produto, cor e canal', async () => {
    // Sem isso o dashboard financeiro não enxergava um centavo de marketplace.
    const { mock, tx } = mockComVariacao(10);
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.importar(pedidoFake());

    const venda = tx.venda.create.mock.calls[0]?.[0].data;
    expect(venda).toMatchObject({
      produtoId: 'p1',
      variacaoId: 'v1',
      pedidoItemId: 'item-novo',
      canal: 'SHOPEE',
    });
  });

  it('item que foi pra produção também gera venda — o cliente já pagou', async () => {
    const { mock, tx } = mockComVariacao(0);
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.importar(pedidoFake());

    expect(tx.venda.create).toHaveBeenCalledTimes(1);
  });

  it('item sem vínculo NÃO gera venda', async () => {
    // Não dá pra faturar o que não se sabe o que é.
    const { mock, tx } = makeMock();
    tx.produtoVariacao.findUnique.mockResolvedValue(null);
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.importar(pedidoFake());

    expect(tx.venda.create).not.toHaveBeenCalled();
  });

  /** Pedido que já existe no banco — o caminho de atualização de status. */
  function pedidoJaImportado(statusAtual = 'ATENDIDO') {
    const { mock, tx } = makeMock();
    mock.pedidoMarketplace.findUnique.mockResolvedValue({ id: 'ped1', status: statusAtual });
    mock.pedidoItem.findMany.mockResolvedValue([{ id: 'item-novo', jobProducaoId: 'job1' }]);
    mock.jobProducao.updateMany.mockResolvedValue({ count: 1 });
    return { mock, tx };
  }

  it('cancelar o pedido remove as vendas dele', async () => {
    const { mock } = pedidoJaImportado('ATENDIDO');
    mock.venda = { create: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.importar(pedidoFake({ statusExterno: 'CANCELLED' }));

    expect(mock.venda.deleteMany).toHaveBeenCalledWith({
      where: { pedidoItemId: { in: ['item-novo'] } },
    });
  });

  it('pedido que só mudou pra enviado não mexe em venda nenhuma', async () => {
    const { mock } = pedidoJaImportado('ATENDIDO');
    mock.venda = { create: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
    const svc = new AtendimentoService(mock as unknown as PrismaService);

    await svc.importar(pedidoFake({ statusExterno: 'SHIPPED' }));

    expect(mock.venda.deleteMany).not.toHaveBeenCalled();
  });
});
