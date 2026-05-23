import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OportunidadesCron } from '../src/modules/oportunidades/oportunidades.cron';
import { OportunidadesService } from '../src/modules/oportunidades/oportunidades.service';
import type { ShopeeProvider } from '../src/modules/oportunidades/providers/shopee.provider';
import type { OportunidadeCandidato } from '../src/modules/oportunidades/providers/marketplace-provider';
import { asPrisma, makeAuditMock, makePrismaMock } from './helpers/prisma-mock';

function makeCron(shopeeImpl: Partial<ShopeeProvider> = {}) {
  const { mock } = makePrismaMock();
  const oportunidades = new OportunidadesService(asPrisma(mock), makeAuditMock());
  // mock só dos métodos que o cron toca
  const shopee = {
    marketplace: 'SHOPEE',
    listFromMonitored: vi.fn(),
    ...shopeeImpl,
  } as unknown as ShopeeProvider;
  const cron = new OportunidadesCron(asPrisma(mock), shopee, oportunidades);
  return { cron, prisma: mock, shopee };
}

function candidato(externalId: string): OportunidadeCandidato {
  return {
    marketplace: 'SHOPEE',
    externalId,
    productName: `prod ${externalId}`,
    priceMinCentavos: 3000,
    priceMaxCentavos: 3000,
    imageUrl: 'x',
    productLink: 'x',
    vendasAfiliadoMes: 500,
    ratingStar: 4.5,
    categoriaIds: [],
    lojaExternalId: null,
    lojaNome: null,
  };
}

describe('OportunidadesCron.descobrirNoveProdutos', () => {
  it('reporta vistos=0 quando provider não devolve nada', async () => {
    const { cron, shopee } = makeCron();
    (shopee.listFromMonitored as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const r = await cron.descobrirNoveProdutos();
    expect(r).toEqual({ criadas: 0, vistos: 0, batches: 0 });
  });

  it('pede TODOS os candidatos (limit = MAX_SAFE_INTEGER) — sem cap pré-dedup', async () => {
    const { cron, prisma, shopee } = makeCron();
    (shopee.listFromMonitored as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    prisma.produtoOportunidade.findMany.mockResolvedValue([]);
    await cron.descobrirNoveProdutos();
    const opts = (shopee.listFromMonitored as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(opts.limit).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('filtra duplicatas: só cria os externalIds que ainda não estão no backlog', async () => {
    const { cron, prisma, shopee } = makeCron();
    (shopee.listFromMonitored as ReturnType<typeof vi.fn>).mockResolvedValue([
      candidato('aa'),
      candidato('bb'),
      candidato('cc'),
    ]);
    // 'aa' já existe; 'bb' e 'cc' novos.
    prisma.produtoOportunidade.findMany.mockResolvedValue([{ externalId: 'aa' }]);
    prisma.$transaction.mockImplementation(async (arg) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return [];
    });
    prisma.produtoOportunidade.upsert.mockResolvedValue({ id: 'mock' });

    const r = await cron.descobrirNoveProdutos();

    expect(r.vistos).toBe(3);
    expect(r.criadas).toBe(2);
    expect(r.batches).toBe(1);
    // upsert chamado pra cada novo (via createBulk → $transaction com array de upserts)
    const txCall = prisma.$transaction.mock.calls[0]?.[0];
    expect(Array.isArray(txCall)).toBe(true);
    expect((txCall as unknown[]).length).toBe(2);
  });

  it('reporta criadas=0 quando todos já existem (mas vistos > 0)', async () => {
    const { cron, prisma, shopee } = makeCron();
    (shopee.listFromMonitored as ReturnType<typeof vi.fn>).mockResolvedValue([
      candidato('aa'),
      candidato('bb'),
    ]);
    prisma.produtoOportunidade.findMany.mockResolvedValue([
      { externalId: 'aa' },
      { externalId: 'bb' },
    ]);
    const r = await cron.descobrirNoveProdutos();
    expect(r).toEqual({ criadas: 0, vistos: 2, batches: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('divide em múltiplos batches quando há mais novos que BATCH_SIZE (500)', async () => {
    const { cron, prisma, shopee } = makeCron();
    // 1200 candidatos novos → 3 batches (500 + 500 + 200)
    const muitos = Array.from({ length: 1200 }, (_, i) => candidato(String(i)));
    (shopee.listFromMonitored as ReturnType<typeof vi.fn>).mockResolvedValue(muitos);
    prisma.produtoOportunidade.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (arg) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return [];
    });
    prisma.produtoOportunidade.upsert.mockResolvedValue({ id: 'mock' });

    const r = await cron.descobrirNoveProdutos();

    expect(r.vistos).toBe(1200);
    expect(r.criadas).toBe(1200);
    expect(r.batches).toBe(3);
    // 3 chamadas a $transaction, cada com array de tamanho 500/500/200
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    const lens = prisma.$transaction.mock.calls.map((c) => (c[0] as unknown[]).length);
    expect(lens).toEqual([500, 500, 200]);
  });
});
