import 'reflect-metadata';
import { BadGatewayException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PublicacaoService } from '../src/modules/mercado-livre/publicacao/publicacao.service';
import type { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';
import type { PublicacaoJournal } from '../src/modules/mercado-livre/publicacao/publicacao-journal';

function preparar() {
  const get = vi.fn(async (path: string): Promise<unknown> => {
    if (path === '/users/42')
      return { id: 42, site_id: 'MLB', tags: ['user_product_seller'], first_name: 'PRIVADO' };
    if (path.includes('/items/search')) return { results: ['MLB123'], paging: { total: 1 } };
    if (path === '/items/MLB123?include_attributes=all')
      return {
        id: 'MLB123',
        seller_id: 42,
        status: 'paused',
        sub_status: ['picture_pending'],
        price: 22.9,
        available_quantity: 8,
        attributes: [{ name: 'Cor', value_name: 'Branco' }],
        user_product_id: 'MLBU123',
        seller_address: { street: 'PRIVADO' },
        shipping: { mode: 'me2', free_shipping: true, address: 'PRIVADO' },
        pictures: [
          { id: 'foto1', secure_url: 'https://example.test/foto.jpg', private: 'PRIVADO' },
        ],
      };
    if (path === '/user-products/MLBU123')
      return { id: 'MLBU123', family_id: '5896969823350698505', address: 'PRIVADO' };
    if (path.endsWith('/fiscal_information/detail'))
      return { items: [{ item_id: 'MLB123', sku: 'DRAG-BR' }] };
    if (path === '/can_invoice/items/MLB123')
      return { item_id: 'MLB123', seller_id: 42, status: false };
    if (path.includes('/shipping_options/free'))
      return { coverage: { all_country: { list_cost: 14.45 } } };
    if (path === '/items/fiscal_information/AUSENTE')
      throw new BadGatewayException({ mercadoLivreStatus: 404 });
    if (path === '/items/fiscal_information/NEGADO')
      throw new BadGatewayException({
        mercadoLivreStatus: 403,
        mercadoLivreOperacao: 'GET',
        mercadoLivreCaminho: path,
        mercadoLivreCausas: { error_code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES', cause: [] },
        message: 'PRIVADO',
      });
    return {
      sku: 'DRAG-BR',
      title: 'Dragão',
      tax_information: { ncm: '95030039' },
      private: 'PRIVADO',
    };
  });
  const post = vi.fn();
  const put = vi.fn();
  const repositorio = { carregar: vi.fn(async () => []), registrar: vi.fn() };
  const journal = { adquirir: vi.fn(), carregar: vi.fn(), salvar: vi.fn() };
  const http = { sellerId: '42', get, post, put } as unknown as MercadoLivreHttpService;
  return {
    service: new PublicacaoService(http, repositorio, journal as unknown as PublicacaoJournal),
    get,
    post,
    put,
    repositorio,
    journal,
  };
}

const entrada = {
  modo: 'inspecionar',
  produtoIds: ['produto1'],
  categorias: [],
  skus: ['DRAG-BR', 'DRAG-AZ'],
  fiscaisSkus: ['DRAG-BR', 'NEGADO', 'AUSENTE'],
};

describe('Inspeção somente leitura da publicação ML', () => {
  it('isola falhas fiscais por SKU e mantém 404 como null sem abortar o lote', async () => {
    const { service } = preparar();
    const resultado = await service.inspecionar(entrada);
    expect(resultado.fiscais).toEqual([
      {
        sku: 'DRAG-BR',
        cadastro: { sku: 'DRAG-BR', title: 'Dragão', tax_information: { ncm: '95030039' } },
      },
      {
        sku: 'NEGADO',
        cadastro: {
          indisponivel: true,
          status: 403,
          mercadoLivreOperacao: 'GET',
          mercadoLivreCaminho: '/items/fiscal_information/NEGADO',
          mercadoLivreCausas: { error_code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES', cause: [] },
        },
      },
      { sku: 'AUSENTE', cadastro: null },
    ]);
    expect(JSON.stringify(resultado)).not.toContain('PRIVADO');
  });

  it('inspeciona item próprio uma vez, com status real, família e cotação pelo item_id', async () => {
    const contexto = preparar();
    const resultado = await contexto.service.inspecionar(entrada);
    expect(resultado.anuncios).toHaveLength(1);
    expect(resultado.anuncios[0]).toMatchObject({
      status: 'paused',
      sub_status: ['picture_pending'],
      userProduct: { family_id: '5896969823350698505' },
      canInvoice: { status: false },
      frete: { coverage: { all_country: { list_cost: 14.45 } } },
    });
    expect(
      contexto.get.mock.calls.filter(([path]) => path === '/items/MLB123?include_attributes=all'),
    ).toHaveLength(1);
    expect(contexto.get).toHaveBeenCalledWith(
      '/users/42/shipping_options/free?item_id=MLB123&verbose=true',
    );
    expect(contexto.post).not.toHaveBeenCalled();
    expect(contexto.put).not.toHaveBeenCalled();
    expect(contexto.journal.adquirir).not.toHaveBeenCalled();
    expect(contexto.journal.salvar).not.toHaveBeenCalled();
    expect(contexto.repositorio.registrar).not.toHaveBeenCalled();
  });

  it('não expõe detalhes nem consulta frete/fiscal de item de outra conta', async () => {
    const contexto = preparar();
    const original = contexto.get.getMockImplementation()!;
    contexto.get.mockImplementation(async (path) =>
      path === '/items/MLB123?include_attributes=all'
        ? { seller_id: 99, address: 'PRIVADO' }
        : original(path),
    );
    const resultado = await contexto.service.inspecionar({ ...entrada, fiscaisSkus: [] });
    expect(resultado.anuncios).toEqual([
      { id: 'MLB123', indisponivel: true, motivo: 'Anúncio de outra conta.' },
    ]);
    expect(
      contexto.get.mock.calls.some(
        ([path]) =>
          path.includes('shipping_options') ||
          path.includes('can_invoice') ||
          path.includes('fiscal_information'),
      ),
    ).toBe(false);
  });
});
