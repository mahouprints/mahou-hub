import 'reflect-metadata';
import { BadGatewayException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';
import { PacotesService } from '../src/modules/mercado-livre/publicacao/pacotes.service';
import type {
  PacoteItem,
  ProdutoPacote,
} from '../src/modules/mercado-livre/publicacao/pacotes-schema';

const item: PacoteItem = {
  produtoId: 'produto1',
  itemId: 'MLB123',
  sku: 'DRAG-BR',
  userProductId: 'MLBU123',
  categoriaId: 'MLB1839',
  precoCentavos: 2290,
  pacote: { alturaCm: 2, larguraCm: 15, comprimentoCm: 20, pesoGramas: 23 },
};
const atributos = [
  { id: 'SELLER_PACKAGE_HEIGHT', value_name: '2 cm' },
  { id: 'SELLER_PACKAGE_WIDTH', value_name: '15 cm' },
  { id: 'SELLER_PACKAGE_LENGTH', value_name: '20 cm' },
  { id: 'SELLER_PACKAGE_WEIGHT', value_name: '23 g' },
];
const anuncio = {
  id: item.itemId,
  seller_id: 42,
  user_product_id: item.userProductId,
  category_id: item.categoriaId,
  status: 'active',
  price: 22.9,
  currency_id: 'BRL',
  available_quantity: 8,
  listing_type_id: 'gold_special',
  condition: 'new',
  shipping: { mode: 'me2', logistic_type: 'xd_drop_off', free_shipping: true, address: 'PRIVADO' },
  attributes: [
    { id: 'SELLER_SKU', value_name: item.sku },
    { id: 'WEIGHT', value_name: '13 g' },
    ...atributos.map((valor) => ({
      ...valor,
      value_name: valor.id.endsWith('WEIGHT') ? '850 g' : '18 cm',
    })),
  ],
  last_updated: '2026-10-19T20:00:00Z',
  seller_address: 'PRIVADO',
};
const produto: ProdutoPacote = {
  id: item.produtoId,
  ativo: true,
  rascunho: false,
  precoCentavos: 2290,
  pesoG: 13,
  variacoes: [{ sku: item.sku, ativo: true, precoCentavos: null, pesoG: null }],
  mercadoLivre: {
    categoriaId: item.categoriaId,
    tipoAnuncio: 'gold_special',
    modoEnvio: 'me2',
    tipoLogistica: 'xd_drop_off',
    freteGratis: true,
    condicao: 'new',
    ...item.pacote,
    publicacao: {
      versao: 1,
      execucaoId: 'historico',
      status: 'concluido',
      atualizadoEm: '2026-10-19T18:00:00Z',
      itens: [
        {
          chave: item.sku,
          itemId: item.itemId,
          userProductId: item.userProductId,
          skus: [item.sku],
          descricaoConfirmada: true,
          fiscalConfirmado: true,
          verificado: true,
        },
      ],
    },
  },
};

function preparar() {
  const remoto = structuredClone(anuncio);
  const catalogo = [structuredClone(produto)];
  const carregar = vi.fn(async () => catalogo);
  const get = vi.fn(async (path: string): Promise<unknown> => {
    if (path === '/items/MLB123?include_attributes=all') return structuredClone(remoto);
    if (path.includes('/categories/'))
      return {
        category_id: 'MLB1839',
        dimensions: { weight: 850 },
        source: { origin: 'categories', identifier: 'MLB1839' },
        address: 'PRIVADO',
      };
    if (path === '/user-products/MLBU123')
      return {
        id: 'MLBU123',
        user_id: 42,
        family_id: '12345678901234567890',
        attributes: remoto.attributes,
        address: 'PRIVADO',
      };
    if (path.includes('/items/search?'))
      return { results: ['MLB123'], paging: { total: 1 }, address: 'PRIVADO' };
    if (path.includes('/customers/'))
      return {
        services: [
          {
            type: 'distribution',
            direction: 'forward',
            legacy_attributes: { mode: 'me2', logistic_type: 'xd_drop_off' },
            network: { address: 'PRIVADO' },
          },
        ],
      };
    if (path.includes('/shipping_options/'))
      return {
        coverage: { all_country: { list_cost: 14.45, billable_weight: 850 } },
        address: 'PRIVADO',
      };
    throw new Error('Rota inesperada');
  });
  const put = vi.fn(async (_path: string, body: unknown) => {
    const atualizacao = body as { attributes: typeof atributos };
    remoto.attributes = [
      ...remoto.attributes.filter((valor) => !valor.id.startsWith('SELLER_PACKAGE_')),
      ...atualizacao.attributes,
    ];
  });
  const http = { sellerId: '42', get, put } as unknown as MercadoLivreHttpService;
  return { service: new PacotesService(http, { carregar }), get, put, carregar, remoto, catalogo };
}

describe('Inspeção e correção isolada de pacotes ML', () => {
  it('inspeciona origem, atributos e logística sem gravar nem expor endereços', async () => {
    const contexto = preparar();
    const resultado = await contexto.service.executar({
      modo: 'inspecionar_pacotes',
      itens: [item],
    });
    expect(contexto.put).not.toHaveBeenCalled();
    expect(JSON.stringify(resultado)).not.toContain('PRIVADO');
    expect(resultado.itens[0]).toMatchObject({
      anuncio: {
        last_updated: anuncio.last_updated,
        attributes: expect.arrayContaining([{ id: 'WEIGHT', value_name: '13 g' }]),
      },
      categoria: { dimensions: { weight: 850 }, source: { origin: 'categories' } },
      associados: { results: ['MLB123'], total: 1, completo: true },
      frete: { coverage: { all_country: { list_cost: 14.45 } } },
    });
    expect(contexto.get).toHaveBeenCalledWith(
      '/users/42/shipping_options/free?item_id=MLB123&verbose=true&free_shipping=true',
    );
  });

  it('grava exclusivamente quatro atributos, relê e preserva produto, estoque e publicação', async () => {
    const contexto = preparar();
    const original = structuredClone(contexto.catalogo);
    const resultado = await contexto.service.executar({ modo: 'corrigir_pacotes', itens: [item] });
    expect(resultado).toMatchObject({
      concluido: true,
      itens: [{ alterado: true, confirmado: true }],
    });
    expect(contexto.put).toHaveBeenCalledTimes(1);
    expect(contexto.put).toHaveBeenCalledWith('/items/MLB123', { attributes: atributos });
    expect(contexto.catalogo).toEqual(original);
    expect(contexto.remoto.attributes).toContainEqual({ id: 'WEIGHT', value_name: '13 g' });
    expect(resultado.itens[0]).toHaveProperty('antes');
    expect(resultado.itens[0]).toHaveProperty('depois');
  });

  it('não grava quando o pacote já confere', async () => {
    const contexto = preparar();
    contexto.remoto.attributes = [...anuncio.attributes.slice(0, 2), ...atributos];
    const resultado = await contexto.service.executar({ modo: 'corrigir_pacotes', itens: [item] });
    expect(resultado).toMatchObject({
      concluido: true,
      itens: [{ alterado: false, gravacaoTentada: false }],
    });
    expect(contexto.put).not.toHaveBeenCalled();
  });

  it.each([
    { seller_id: 99 },
    { id: 'MLB999' },
    { user_product_id: 'MLBU999' },
    { category_id: 'MLB999' },
    { price: 25.9 },
    { status: 'paused' },
    { attributes: [{ id: 'SELLER_SKU', value_name: 'OUTRO' }] },
    { variations: [{ id: 1 }] },
    { currency_id: 'USD' },
    { shipping: { ...anuncio.shipping, free_shipping: false } },
  ])('não grava quando identidade ou contexto remoto diverge: %j', async (mudanca) => {
    const contexto = preparar();
    Object.assign(contexto.remoto, mudanca);
    await expect(
      contexto.service.executar({ modo: 'corrigir_pacotes', itens: [item] }),
    ).rejects.toThrow();
    expect(contexto.put).not.toHaveBeenCalled();
  });

  it.each([
    { ativo: false },
    { rascunho: true },
    { precoCentavos: 2500 },
    { pesoG: 24 },
    { variacoes: [] },
    { mercadoLivre: {} },
  ])('não grava quando cadastro ERP diverge: %j', async (mudanca) => {
    const contexto = preparar();
    Object.assign(contexto.catalogo[0]!, mudanca);
    await expect(
      contexto.service.executar({ modo: 'corrigir_pacotes', itens: [item] }),
    ).rejects.toThrow();
    expect(contexto.put).not.toHaveBeenCalled();
  });

  it('exige pacote idêntico ao ERP e vínculo individual com o User Product', async () => {
    for (const entrada of [
      { ...item, pacote: { ...item.pacote, pesoGramas: 24 } },
      { ...item, userProductId: 'MLBU999' },
      { ...item, sku: 'OUTRO' },
    ]) {
      const contexto = preparar();
      await expect(
        contexto.service.executar({ modo: 'corrigir_pacotes', itens: [entrada] }),
      ).rejects.toThrow();
      expect(contexto.put).not.toHaveBeenCalled();
    }
  });

  it('valida todo o lote e impede o primeiro PUT se o último item é inválido', async () => {
    const contexto = preparar();
    await expect(
      contexto.service.executar({
        modo: 'corrigir_pacotes',
        itens: [item, { ...item, itemId: 'MLB456', userProductId: 'MLBU456', sku: 'DRAG-AZ' }],
      }),
    ).rejects.toThrow();
    expect(contexto.put).not.toHaveBeenCalled();
  });

  it('recusa duplicatas na entrada antes de qualquer requisição', async () => {
    const contexto = preparar();
    await expect(
      contexto.service.executar({ modo: 'corrigir_pacotes', itens: [item, item] }),
    ).rejects.toThrow();
    expect(contexto.get).not.toHaveBeenCalled();
    expect(contexto.put).not.toHaveBeenCalled();
  });

  it.each(['alturaCm', 'larguraCm', 'comprimentoCm'] as const)(
    'recusa centímetros fracionários no atributo %s antes de consultar',
    async (campo) => {
      const contexto = preparar();
      await expect(
        contexto.service.executar({
          modo: 'corrigir_pacotes',
          itens: [{ ...item, pacote: { ...item.pacote, [campo]: 2.5 } }],
        }),
      ).rejects.toThrow('centímetros inteiros');
      expect(contexto.get).not.toHaveBeenCalled();
      expect(contexto.put).not.toHaveBeenCalled();
    },
  );

  it.each([
    { path: '/user-products/MLBU123', resposta: { id: 'MLBU123', user_id: 99 } },
    { path: '/user-products/MLBU123', resposta: { id: 'MLBU123' } },
    { path: '/user-products/MLBU123', resposta: { id: 'MLBU999', user_id: 42 } },
    { path: '/items/search?', resposta: { results: ['MLB123', 'MLB456'], paging: { total: 2 } } },
    { path: '/items/search?', resposta: { results: ['MLB123'], paging: { total: 2 } } },
    { path: '/items/search?', resposta: { results: ['MLB456'], paging: { total: 1 } } },
    { path: '/items/search?', resposta: { results: ['MLB123'] } },
  ])(
    'não permite propagação do PUT sem propriedade e associação únicas: %j',
    async ({ path, resposta }) => {
      const contexto = preparar();
      const original = contexto.get.getMockImplementation()!;
      contexto.get.mockImplementation(async (atual) =>
        atual.includes(path) ? resposta : original(atual),
      );
      await expect(
        contexto.service.executar({ modo: 'corrigir_pacotes', itens: [item] }),
      ).rejects.toThrow('propagação restrita');
      expect(contexto.put).not.toHaveBeenCalled();
    },
  );

  it('refaz a guarda quando o anúncio muda depois de validar o lote', async () => {
    const contexto = preparar();
    const original = contexto.get.getMockImplementation()!;
    let consultasItem = 0;
    contexto.get.mockImplementation(async (path) => {
      if (path === '/items/MLB123?include_attributes=all' && ++consultasItem > 1)
        return { ...contexto.remoto, price: 99.9 };
      return original(path);
    });
    const resultado = await contexto.service.executar({ modo: 'corrigir_pacotes', itens: [item] });
    expect(resultado).toMatchObject({
      concluido: false,
      itens: [{ gravacaoTentada: false, confirmado: false }],
    });
    expect(contexto.put).not.toHaveBeenCalled();
  });

  it('preserva diagnóstico opcional sanitizado sem impedir inspeção', async () => {
    const contexto = preparar();
    const original = contexto.get.getMockImplementation()!;
    contexto.get.mockImplementation(async (path) => {
      if (path.includes('/customers/'))
        throw new BadGatewayException({ mercadoLivreStatus: 403, message: 'SEGREDO' });
      return original(path);
    });
    const resultado = await contexto.service.executar({
      modo: 'inspecionar_pacotes',
      itens: [item],
    });
    expect(resultado.itens[0]).toMatchObject({ logistica: { indisponivel: true, status: 403 } });
    expect(JSON.stringify(resultado)).not.toContain('SEGREDO');
    expect(contexto.put).not.toHaveBeenCalled();
  });

  it('não repete escrita incerta e devolve leitura posterior sem confirmar sucesso', async () => {
    const contexto = preparar();
    contexto.put.mockRejectedValueOnce(new Error('SEGREDO'));
    const resultado = await contexto.service.executar({ modo: 'corrigir_pacotes', itens: [item] });
    expect(resultado).toMatchObject({
      concluido: false,
      itens: [
        { confirmado: false, gravacaoTentada: true, alterado: false, depois: expect.any(Object) },
      ],
    });
    expect(contexto.put).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(resultado)).not.toContain('SEGREDO');
  });

  it('não declara sucesso quando o ML não preserva os atributos após aceitar PUT', async () => {
    const contexto = preparar();
    contexto.put.mockResolvedValueOnce(undefined);
    const resultado = await contexto.service.executar({ modo: 'corrigir_pacotes', itens: [item] });
    expect(resultado).toMatchObject({
      concluido: false,
      itens: [{ confirmado: false, alterado: true }],
    });
    expect(contexto.put).toHaveBeenCalledTimes(1);
  });
});
