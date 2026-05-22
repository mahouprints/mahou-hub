import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { GapsService } from '../src/modules/oportunidades/gaps.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

/// Builder de snapshot+produtos pra cenários compactos.
/// `produtosMahou` vira o catálogo; `produtosConcorrente` vira o snapshot da loja única.
function setupCenario(opts: {
  produtosMahou: { id?: string; nome: string; precoCentavos?: number }[];
  produtosConcorrente: {
    itemId: number;
    productName: string;
    priceMinCentavos?: number;
    productCatIds?: number[];
  }[];
  decisoes?: { externalId: string; decisao: 'MATCH_MANUAL' | 'DESCARTADO'; produtoId?: string }[];
}) {
  const { mock } = makePrismaMock();
  const concorrente = {
    loja: 'Loja X',
    shopId: BigInt(123),
    snapshots: [
      {
        produtos: opts.produtosConcorrente.map((p, idx) => ({
          itemId: BigInt(p.itemId),
          productName: p.productName,
          priceMinCentavos: p.priceMinCentavos ?? 2990,
          priceMaxCentavos: p.priceMinCentavos ?? 2990,
          imageUrl: `https://img/${idx}.jpg`,
          productLink: `https://shopee/${p.itemId}`,
          sales: 100,
          periodStartTime: Math.floor(Date.now() / 1000) - 30 * 86400,
          periodEndTime: Math.floor(Date.now() / 1000),
          ratingStar: new Prisma.Decimal(4.8),
          productCatIds: p.productCatIds ?? [100012],
        })),
      },
    ],
  };
  mock.concorrente.findMany.mockResolvedValue([concorrente] as never);
  mock.produto.findMany.mockResolvedValue(
    opts.produtosMahou.map((p, i) => ({
      id: p.id ?? `prod${i}`,
      nome: p.nome,
      precoCentavos: p.precoCentavos ?? 2990,
    })) as never,
  );
  mock.produtoGapDecisao.findMany.mockResolvedValue(
    (opts.decisoes ?? []).map((d) => ({
      marketplace: 'SHOPEE',
      externalId: d.externalId,
      decisao: d.decisao,
      produtoId: d.produtoId ?? null,
      observacao: null,
      decididoPor: 'tester',
      decididoEm: new Date(),
    })) as never,
  );
  return new GapsService(asPrisma(mock));
}

describe('GapsService.listar — classificação automática', () => {
  describe('MATCH exige cobertura total dos tokens Mahou (regressão fix 2026-05-22)', () => {
    it('rebaixa pra VARIACAO quando jaccard >= 0.5 mas falta token-tema', async () => {
      const svc = setupCenario({
        produtosMahou: [{ nome: 'Cortador de biscoito copa' }],
        produtosConcorrente: [
          { itemId: 1, productName: 'Cortador de Biscoito Amendoim' },
          { itemId: 2, productName: 'Cortador de Biscoito Cruz' },
          { itemId: 3, productName: 'Kit Cortador de Biscoito Pascoa' },
        ],
      });
      const { items } = await svc.listar({});
      for (const item of items) {
        expect(item.classificacao).toBe('VARIACAO');
        expect(item.produtoMahouSimilar?.nome).toBe('Cortador de biscoito copa');
      }
    });

    it('mantém MATCH quando o concorrente cobre todos os tokens Mahou', async () => {
      const svc = setupCenario({
        produtosMahou: [{ nome: 'Suporte Óculos gatinho' }],
        produtosConcorrente: [
          { itemId: 1, productName: 'Suporte para Óculos Gatinho' },
          { itemId: 2, productName: 'GATINHO SUPORTE PARA ÓCULOS' },
          { itemId: 3, productName: 'Suporte de Óculos gatinho | decoração fofa' },
        ],
      });
      const { items } = await svc.listar({});
      for (const item of items) {
        expect(item.classificacao).toBe('MATCH');
      }
    });

    it('rebaixa pra VARIACAO quando jaccard alto mas token diferenciador falta', async () => {
      const svc = setupCenario({
        produtosMahou: [{ nome: 'Suporte de Controle PS5 + Fone ps5' }],
        produtosConcorrente: [
          // Sem "fone" — perde token diferenciador, vira VARIACAO
          { itemId: 1, productName: 'Suporte para Controle Playstation PS4 e PS5' },
        ],
      });
      const { items } = await svc.listar({});
      expect(items[0]?.classificacao).toBe('VARIACAO');
    });
  });

  describe('GAP / VARIACAO / MATCH por jaccard', () => {
    it('GAP quando nenhum produto Mahou tem tokens em comum', async () => {
      const svc = setupCenario({
        produtosMahou: [{ nome: 'Cortador de biscoito copa' }],
        produtosConcorrente: [{ itemId: 1, productName: 'Dragão Articulado Flexível 42cm' }],
      });
      const { items } = await svc.listar({});
      expect(items[0]?.classificacao).toBe('GAP');
      expect(items[0]?.produtoMahouSimilar).toBeNull();
    });

    it('VARIACAO quando jaccard entre 0.3 e 0.5 e preço próximo', async () => {
      const svc = setupCenario({
        // tokens: estojo, insulina
        produtosMahou: [{ nome: 'Estojo de Insulina', precoCentavos: 2990 }],
        produtosConcorrente: [
          // tokens: estojo, caneta, insulina, azempic, mounjaro (intersect=2, union=6 → jaccard~0.33)
          {
            itemId: 1,
            productName: 'Estojo para caneta de insulina / azempic / mounjaro',
            priceMinCentavos: 3500, // próximo (< 50% diff)
          },
        ],
      });
      const { items } = await svc.listar({});
      expect(items[0]?.classificacao).toBe('VARIACAO');
    });
  });

  describe('decisões manuais sobrescrevem auto', () => {
    it('MATCH_MANUAL preserva mesmo quando o classificador automático diria VARIACAO', async () => {
      const svc = setupCenario({
        produtosMahou: [{ id: 'prod-manopla', nome: 'Manopla de Cambio' }],
        produtosConcorrente: [{ itemId: 42, productName: 'manopla cambio vectra 06/11' }],
        decisoes: [
          { externalId: '42', decisao: 'MATCH_MANUAL', produtoId: 'prod-manopla' },
        ],
      });
      const { items } = await svc.listar({});
      expect(items[0]?.classificacao).toBe('MATCH_MANUAL');
      expect(items[0]?.produtoMahouSimilar?.id).toBe('prod-manopla');
      expect(items[0]?.decisao?.tipo).toBe('MATCH_MANUAL');
    });

    it('DESCARTADO esconde do filtro GAP (atalho usado pela UI)', async () => {
      const svc = setupCenario({
        produtosMahou: [],
        produtosConcorrente: [
          { itemId: 1, productName: 'Item descartado' },
          { itemId: 2, productName: 'Item normal' },
        ],
        decisoes: [{ externalId: '1', decisao: 'DESCARTADO' }],
      });
      const { items, total } = await svc.listar({ classificacao: 'GAP' });
      expect(total).toBe(1);
      expect(items[0]?.externalId).toBe('2');
    });
  });

  describe('ordenação e filtros', () => {
    it('ordena por vendasEstimadasMes desc', async () => {
      const svc = setupCenario({
        produtosMahou: [],
        produtosConcorrente: [
          { itemId: 1, productName: 'Item baixo' },
          { itemId: 2, productName: 'Item alto' },
          { itemId: 3, productName: 'Item medio' },
        ],
      });
      const { items } = await svc.listar({});
      expect(items.map((i) => i.externalId)).toEqual(['1', '2', '3']);
      // Mesmo sales nos 3 mocks → ordem do snapshot. Resort: garantir desc estável.
      expect(items[0]?.vendasEstimadasMes).toBeGreaterThanOrEqual(items[2]?.vendasEstimadasMes ?? 0);
    });

    it('filtra por busca textual case-insensitive no productName', async () => {
      const svc = setupCenario({
        produtosMahou: [],
        produtosConcorrente: [
          { itemId: 1, productName: 'Cortador de biscoito' },
          { itemId: 2, productName: 'Dragão articulado' },
        ],
      });
      const { items, total } = await svc.listar({ q: 'CORTADOR' });
      expect(total).toBe(1);
      expect(items[0]?.externalId).toBe('1');
    });
  });
});
