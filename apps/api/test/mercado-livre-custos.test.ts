import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import {
  MercadoLivreCustosService,
  type CacheEnviosMl,
} from '../src/modules/mercado-livre/mercado-livre-custos.service';
import { MercadoLivreClient } from '../src/modules/pedidos/mercadolivre.client';
import type { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';

const item = { itemId: 'MLB123', variacaoId: '', qtd: 1 };
const pacote = [
  { order_id: 1, item_id: 'MLB123', variation_id: null, sender_id: 42, quantity: 1 },
  { order_id: 2, item_id: 'MLB456', variation_id: null, sender_id: 42, quantity: 2 },
  { order_id: 3, item_id: 'MLB789', variation_id: null, sender_id: 99, quantity: 5 },
];

function preparar(custo = 13.85) {
  const get = vi.fn(async (path: string): Promise<unknown> => {
    if (path.includes('/shipments?'))
      return [
        { id: 100, type: 'return' },
        { id: 101, type: 'forward' },
        { id: 101, type: 'forward' },
      ];
    if (path.endsWith('/costs'))
      return {
        gross_amount: 30,
        receiver: { cost: 10 },
        senders: [
          { user_id: 42, cost: custo },
          { user_id: 99, cost: 20 },
        ],
      };
    return pacote;
  });
  const http = { get, sellerId: '42' } as unknown as MercadoLivreHttpService;
  return { service: new MercadoLivreCustosService(http), get, http };
}

describe('Custos reais ML', () => {
  it('deduplica envio e rateia só custo do vendedor entre pedidos de um pacote, sem perder centavos', async () => {
    const { service, get } = preparar();
    const cache: CacheEnviosMl = new Map();
    const primeiro = await service.fretePorItens('1', [item], cache);
    const segundo = await service.fretePorItens(
      '2',
      [{ ...item, itemId: 'MLB456', qtd: 2 }],
      cache,
    );
    expect(primeiro).toEqual([462]);
    expect(segundo).toEqual([923]);
    expect(primeiro[0]! + segundo[0]!).toBe(1385);
    expect(get.mock.calls.filter(([path]) => path.endsWith('/costs'))).toHaveLength(1);
    expect(get.mock.calls.every(([path]) => !path.includes('/100/'))).toBe(true);
  });

  it('zero explícito é custo conhecido', async () => {
    const { service } = preparar(0);
    expect(await service.fretePorItens('1', [item])).toEqual([0]);
  });

  it('quantidade incompleta e identidade ambígua não geram margem falsa', async () => {
    const { service } = preparar();
    expect(await service.fretePorItens('1', [{ ...item, qtd: 2 }])).toEqual([null]);
    expect(await service.fretePorItens('1', [item, item])).toEqual([null, null]);
  });

  it('falha ou envio ainda propagando mantém custo desconhecido', async () => {
    const { service, get } = preparar();
    get.mockRejectedValueOnce(new Error('204'));
    expect(await service.fretePorItens('1', [item])).toEqual([null]);
    get.mockResolvedValueOnce([]);
    expect(await service.fretePorItens('1', [item])).toEqual([null]);
  });

  it('soma envios forward separados e ignora devolução', async () => {
    const { service, get } = preparar();
    get.mockImplementation(async (path) => {
      if (path.includes('/shipments?'))
        return [
          { id: 101, type: 'forward' },
          { id: 102, type: 'forward' },
          { id: 103, type: 'return' },
        ];
      if (path.endsWith('/costs')) return { senders: [{ user_id: 42, cost: 5 }] };
      return [pacote[0]];
    });
    expect(await service.fretePorItens('1', [{ ...item, qtd: 2 }])).toEqual([1000]);
  });

  it('tarifa unitária multiplica quantidade, frete de linha não multiplica novamente', async () => {
    const { service, get, http } = preparar();
    get.mockResolvedValueOnce({
      id: 2,
      status: 'paid',
      total_amount: 49.8,
      order_items: [
        {
          item: { id: 'MLB456', seller_sku: 'RAT-ART-BRANCO' },
          quantity: 2,
          unit_price: 24.9,
          sale_fee: 4.11,
        },
      ],
    });
    const cliente = new MercadoLivreClient(http, service);
    const pedido = await cliente.buscarPedido('2');
    expect(pedido.itens[0]).toMatchObject({
      mlItemId: 'MLB456',
      qtd: 2,
      precoUnitarioCentavos: 2490,
      tarifaMlCentavos: 822,
      freteMlCentavos: 923,
    });
  });

  it('tarifa ausente não vira zero', async () => {
    const { service, get, http } = preparar();
    get.mockResolvedValueOnce({
      id: 1,
      status: 'paid',
      order_items: [{ item: { id: 'MLB123' }, quantity: 1, unit_price: 24.9 }],
    });
    expect(
      (await new MercadoLivreClient(http, service).buscarPedido('1')).itens[0]?.tarifaMlCentavos,
    ).toBeNull();
  });
});
