import { vi } from 'vitest';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { OportunidadeLogService } from '../../src/modules/oportunidades/oportunidade-log.service';

// Mock minimal do PrismaService pro escopo do módulo oportunidades.
// Estende conforme outros módulos forem ganhar testes — não tente cobrir tudo de uma vez.
export function makePrismaMock() {
  const txDelegate = {
    produtoOportunidade: {
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    produto: { create: vi.fn() },
    produtoVariacao: { findUnique: vi.fn(), update: vi.fn() },
    filamento: { findUnique: vi.fn(), update: vi.fn() },
    insumo: { findUnique: vi.fn(), update: vi.fn() },
    movimentoEstoque: { create: vi.fn() },
    jobProducao: { createMany: vi.fn() },
  };

  const mock = {
    produtoOportunidade: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    produto: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    filamento: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    insumo: { findUnique: vi.fn(), findMany: vi.fn() },
    produtoVariacao: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    movimentoEstoque: { findMany: vi.fn(), create: vi.fn() },
    recibo: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    reciboArquivo: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    concorrente: { findMany: vi.fn() },
    oportunidadeLog: { create: vi.fn(), findMany: vi.fn() },
    parametro: { findUnique: vi.fn() },
    taxaShopee: { findMany: vi.fn() },
    taxaMercadoLivre: { findMany: vi.fn() },
    venda: { aggregate: vi.fn(), findMany: vi.fn() },
    jobProducao: {
      aggregate: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    // $transaction aceita: (1) array de promises ou (2) callback com tx.
    // Pra (1) Promise.all; pra (2) executa o callback com txDelegate.
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: typeof txDelegate) => unknown)(txDelegate);
      if (Array.isArray(arg)) return Promise.all(arg);
      return undefined;
    }),
  };
  return { mock, tx: txDelegate };
}

export type PrismaMock = ReturnType<typeof makePrismaMock>['mock'];

export function asPrisma(mock: PrismaMock): PrismaService {
  return mock as unknown as PrismaService;
}

// Audit log mock — todos os métodos viram no-op com vi.fn pra inspeção.
export function makeAuditMock(): OportunidadeLogService {
  return {
    list: vi.fn().mockResolvedValue([]),
    logCreated: vi.fn().mockResolvedValue(null),
    logStatusChange: vi.fn().mockResolvedValue(null),
    logScoreChange: vi.fn().mockResolvedValue(null),
    logNotasChange: vi.fn().mockResolvedValue(null),
    logVirouProduto: vi.fn().mockResolvedValue(null),
  } as unknown as OportunidadeLogService;
}
