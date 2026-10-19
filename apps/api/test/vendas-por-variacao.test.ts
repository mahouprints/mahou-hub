import 'reflect-metadata';
import type { VendaUpdate } from '@mahou-hub/contracts';
import { describe, expect, it, vi } from 'vitest';
import { VendasService } from '../src/modules/vendas/vendas.service';
import type { PrismaService } from '../src/prisma/prisma.service';

function venda(over: Record<string, unknown> = {}) {
  return {
    produtoId: 'p1',
    variacaoId: 'v-azul',
    qtd: 1,
    precoUnitarioCentavos: 3990,
    produto: { nome: 'Polvo Flexível' },
    variacao: { nome: 'Azul', sku: 'POLVO-FLEX-AZ' },
    ...over,
  };
}

function montar(vendas: Array<Record<string, unknown>>) {
  const mock = { venda: { findMany: vi.fn().mockResolvedValue(vendas) } };
  return new VendasService(mock as unknown as PrismaService);
}

describe('VendasService.porVariacao', () => {
  it('soma unidades e receita por cor', async () => {
    const svc = montar([
      venda({ qtd: 8 }),
      venda({ qtd: 4 }),
      venda({ variacaoId: 'v-rosa', qtd: 3, variacao: { nome: 'Rosa', sku: 'POLVO-FLEX-RS' } }),
    ]);

    const r = await svc.porVariacao('2026-07');

    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ cor: 'Azul', unidades: 12, receitaCentavos: 47880 });
    expect(r[1]).toMatchObject({ cor: 'Rosa', unidades: 3 });
  });

  it('ordena da cor que mais sai para a que menos sai', async () => {
    const svc = montar([
      venda({ variacaoId: 'v-rosa', qtd: 2, variacao: { nome: 'Rosa', sku: 'X' } }),
      venda({ variacaoId: 'v-azul', qtd: 9, variacao: { nome: 'Azul', sku: 'Y' } }),
    ]);

    const r = await svc.porVariacao();

    expect(r.map((l) => l.cor)).toEqual(['Azul', 'Rosa']);
  });

  it('venda sem variação não some do relatório', async () => {
    // Sumir seria pior: o total do relatório não bateria com o do financeiro.
    const svc = montar([venda({ variacaoId: null, variacao: null, qtd: 5 })]);

    const r = await svc.porVariacao();

    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ produto: 'Polvo Flexível', cor: null, unidades: 5 });
  });

  it('separa a mesma cor em produtos diferentes', async () => {
    const svc = montar([
      venda({ variacaoId: 'v1', produto: { nome: 'Polvo' }, variacao: { nome: 'Azul', sku: 'A' } }),
      venda({
        variacaoId: 'v2',
        produto: { nome: 'Dragão' },
        variacao: { nome: 'Azul', sku: 'B' },
      }),
    ]);

    const r = await svc.porVariacao();

    expect(r).toHaveLength(2);
    expect(r.map((l) => l.produto).sort()).toEqual(['Dragão', 'Polvo']);
  });

  it('mês vazio devolve lista vazia, não erro', async () => {
    expect(await montar([]).porVariacao('2026-01')).toEqual([]);
  });
});

describe('VendasService.list — origem das despesas ML', () => {
  it('expõe zero confirmado, custo pendente e canal sem conciliação ML separadamente', async () => {
    const svc = montar([
      venda({
        canal: 'ML',
        pedidoItem: {
          qtd: 1,
          precoUnitarioCentavos: 3990,
          tarifaMlCentavos: 100,
          freteMlCentavos: 0,
          custosMlAtualizadosEm: null,
        },
      }),
      venda({ canal: 'ML', pedidoItem: null }),
      venda({ canal: 'SITE', pedidoItem: null }),
    ]);
    const linhas = await svc.list();
    expect(linhas[0]?.custosMl).toMatchObject({
      tarifaCentavos: 100,
      freteCentavos: 0,
      freteFonte: 'IMPORTADO',
    });
    expect(linhas[1]?.custosMl).toMatchObject({
      tarifaCentavos: null,
      freteCentavos: null,
      tarifaFonte: 'PENDENTE',
      freteFonte: 'PENDENTE',
    });
    expect(linhas[2]?.custosMl).toBeNull();
  });
});

describe('VendasService.update — preserva a origem das despesas importadas', () => {
  function preparar(pedidoItemId: string | null = 'item-1') {
    const atual = venda({
      pedidoItemId,
      canal: 'ML',
      qtd: 2,
      pedidoItem: {
        qtd: 2,
        precoUnitarioCentavos: 3990,
        tarifaMlCentavos: 900,
        freteMlCentavos: 651,
        custosMlAtualizadosEm: new Date('2026-09-02Z'),
      },
    });
    const mock = {
      venda: {
        findUnique: vi.fn().mockResolvedValue(atual),
        update: vi.fn().mockResolvedValue(atual),
      },
    };
    return { mock, svc: new VendasService(mock as unknown as PrismaService) };
  }

  it.each<VendaUpdate>([
    { qtd: 3 },
    { precoUnitarioCentavos: 4500 },
    { produtoId: 'outro-produto' },
    { canal: 'SITE' },
  ])('rejeita alteração financeira de venda com despesas reais: %j', async (alteracao) => {
    const { mock, svc } = preparar();
    await expect(svc.update('v1', alteracao)).rejects.toThrow('pedido de origem');
    expect(mock.venda.update).not.toHaveBeenCalled();
  });

  it('permite reenviar os valores originais e corrigir observação e data', async () => {
    const { mock, svc } = preparar();
    const dados = {
      produtoId: 'p1',
      qtd: 2,
      precoUnitarioCentavos: 3990,
      canal: 'ML' as const,
      observacao: 'Conferida',
      dataVenda: new Date('2026-09-03Z'),
    };
    await svc.update('v1', dados);
    expect(mock.venda.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: dados });
  });

  it('mantém a edição financeira de vendas registradas manualmente', async () => {
    const { mock, svc } = preparar(null);
    await svc.update('v1', { qtd: 3 });
    expect(mock.venda.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { qtd: 3 } });
  });
});
