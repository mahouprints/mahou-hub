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
    vendasEstimadasMes: 500,
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
    expect(r).toEqual({ criadas: 0, vistos: 0 });
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
    expect(r).toEqual({ criadas: 0, vistos: 2 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
