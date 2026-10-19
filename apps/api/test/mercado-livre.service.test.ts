import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { MercadoLivreCotacaoInput } from '@mahou-hub/contracts';
import { MercadoLivreService } from '../src/modules/mercado-livre/mercado-livre.service';
import type { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';

const contexto: MercadoLivreCotacaoInput = {
  categoriaId: 'MLB123',
  precoCentavos: 2490,
  tipoAnuncio: 'gold_special',
  modoEnvio: 'me2',
  tipoLogistica: 'drop_off',
  freteGratis: false,
  condicao: 'new',
  pesoGramas: 50,
  alturaCm: 5,
  larguraCm: 8,
  comprimentoCm: 12,
};
const categoria = {
  id: 'MLB123',
  name: 'Animais articulados',
  children_categories: [],
  path_from_root: [
    { id: 'MLB1', name: 'Brinquedos' },
    { id: 'MLB123', name: 'Animais articulados' },
  ],
  settings: { listing_allowed: true },
};

function preparar() {
  const get = vi.fn(async (path: string): Promise<unknown> => {
    if (path.startsWith('/categories/')) return categoria;
    if (path.startsWith('/sites/MLB/listing_prices'))
      return [
        {
          listing_type_id: 'gold_special',
          sale_fee_amount: 8.11,
          sale_fee_details: { fixed_fee: 4, percentage_fee: 16.5 },
        },
      ];
    return { coverage: { all_country: { list_cost: 13.85, discount: { rate: 0.5 } } } };
  });
  const http = { get, sellerId: '42' } as unknown as MercadoLivreHttpService;
  return { service: new MercadoLivreService(http), get };
}

describe('MercadoLivreService', () => {
  it('envia categoria, preço, anúncio e logística e não duplica tarifa fixa ou desconto do frete', async () => {
    const { service, get } = preparar();
    const cotacao = await service.cotar(contexto);
    expect(cotacao).toMatchObject({
      tarifaCentavos: 811,
      tarifaFixaCentavos: 400,
      freteCentavos: 1385,
      percentualTarifa: 16.5,
      pendencias: [],
    });
    const url = get.mock.calls
      .map(([path]) => path)
      .find((path) => path.includes('listing_prices'))!;
    const query = new URL(`https://example.test${url}`).searchParams;
    expect(Object.fromEntries(query)).toEqual({
      category_id: 'MLB123',
      price: '24.90',
      currency_id: 'BRL',
      listing_type_id: 'gold_special',
      logistic_type: 'drop_off',
      shipping_mode: 'me2',
    });
    const frete = get.mock.calls
      .map(([path]) => path)
      .find((path) => path.includes('shipping_options'))!;
    expect(new URL(`https://example.test${frete}`).searchParams.get('dimensions')).toBe(
      '5x8x12,50',
    );
    expect(new URL(`https://example.test${frete}`).searchParams.get('free_shipping')).toBe('false');
  });

  it('refaz a consulta por categoria sem usar tabela genérica', async () => {
    const { service, get } = preparar();
    await service.cotar({ ...contexto, categoriaId: 'MLB456', precoCentavos: 7990 });
    expect(get).toHaveBeenCalledWith(expect.stringContaining('category_id=MLB456&price=79.90'));
  });

  it('rejeita categoria intermediária antes de calcular', async () => {
    const { service, get } = preparar();
    get.mockResolvedValueOnce({ ...categoria, children_categories: [{ id: 'MLB456' }] });
    await expect(service.cotar(contexto)).rejects.toThrow('categoria final');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('mantém frete desconhecido como pendência', async () => {
    const { service, get } = preparar();
    get.mockImplementation(async (path) => {
      if (path.startsWith('/categories')) return categoria;
      if (path.includes('listing_prices'))
        return [
          {
            listing_type_id: 'gold_special',
            sale_fee_amount: 4.11,
            sale_fee_details: { fixed_fee: 0, percentage_fee: 16.5 },
          },
        ];
      throw new Error('Indisponível');
    });
    expect(await service.cotar(contexto)).toMatchObject({
      tarifaCentavos: 411,
      freteCentavos: null,
      pendencias: [expect.any(String)],
    });
  });

  it('aceita total sem breakdown, sem inventar percentual ou parcela fixa', async () => {
    const { service, get } = preparar();
    get
      .mockResolvedValueOnce(categoria)
      .mockResolvedValueOnce([{ listing_type_id: 'gold_special', sale_fee_amount: 4.11 }]);
    expect(await service.cotar(contexto)).toMatchObject({
      tarifaCentavos: 411,
      tarifaFixaCentavos: null,
      percentualTarifa: null,
    });
  });

  it('rejeita tarifa sem valor total ou com moeda divergente', async () => {
    const { service, get } = preparar();
    get
      .mockResolvedValueOnce(categoria)
      .mockResolvedValueOnce([{ listing_type_id: 'gold_special' }]);
    await expect(service.cotar(contexto)).rejects.toThrow('tarifa incompleta');
    get
      .mockResolvedValueOnce(categoria)
      .mockResolvedValueOnce([
        { listing_type_id: 'gold_special', sale_fee_amount: 4.11, currency_id: 'USD' },
      ]);
    await expect(service.cotar(contexto)).rejects.toThrow('tarifa incompleta');
  });

  it('não importa contexto de anúncio de outro vendedor', async () => {
    const { service, get } = preparar();
    get.mockResolvedValueOnce({ seller_id: 99 } as never);
    await expect(service.anuncio('MLB123')).rejects.toThrow('pertencer');
  });

  it('extrai dimensões e preço do anúncio próprio sem mutar marketplace', async () => {
    const { service, get } = preparar();
    get.mockResolvedValueOnce({
      id: 'MLB123',
      seller_id: 42,
      category_id: 'MLB456',
      price: 24.9,
      shipping: { dimensions: '5x8x12,50', mode: 'me2' },
    } as never);
    expect(await service.anuncio('MLB123')).toMatchObject({
      itemId: 'MLB123',
      categoriaId: 'MLB456',
      precoCentavos: 2490,
      alturaCm: 5,
      larguraCm: 8,
      comprimentoCm: 12,
      pesoGramas: 50,
    });
  });
});
