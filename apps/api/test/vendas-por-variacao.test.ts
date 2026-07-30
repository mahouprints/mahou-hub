import 'reflect-metadata';
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
      venda({ variacaoId: 'v2', produto: { nome: 'Dragão' }, variacao: { nome: 'Azul', sku: 'B' } }),
    ]);

    const r = await svc.porVariacao();

    expect(r).toHaveLength(2);
    expect(r.map((l) => l.produto).sort()).toEqual(['Dragão', 'Polvo']);
  });

  it('mês vazio devolve lista vazia, não erro', async () => {
    expect(await montar([]).porVariacao('2026-01')).toEqual([]);
  });
});
