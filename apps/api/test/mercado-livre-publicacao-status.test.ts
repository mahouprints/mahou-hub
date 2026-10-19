import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';
import type {
  PublicacaoJournal,
  JournalPublicacao,
} from '../src/modules/mercado-livre/publicacao/publicacao-journal';
import type { PublicacaoEntrada } from '../src/modules/mercado-livre/publicacao/publicacao-schema';
import { objeto } from '../src/modules/mercado-livre/publicacao/publicacao-verificacao';
import { PublicacaoService } from '../src/modules/mercado-livre/publicacao/publicacao.service';

function preparar(status: string, subStatus: string[]) {
  const itens = Array.from({ length: 7 }, (_, indice) => {
    const sku = `DRAG-COR-${indice}`;
    const quantidade = indice === 0 ? 8 : 2;
    return {
      chave: sku,
      skus: [{ sku, quantidade }],
      payload: {
        family_name: 'Mini dragão colecionável',
        category_id: 'MLB1839',
        currency_id: 'BRL' as const,
        buying_mode: 'buy_it_now' as const,
        listing_type_id: 'gold_special',
        condition: 'new' as const,
        price: 22.9,
        available_quantity: quantidade,
        pictures: [{ source: 'https://media.mahouprints.com/foto.jpg' }],
        attributes: [{ id: 'SELLER_SKU', value_name: sku }],
      },
      descricao: 'Colecionável para maiores de 14 anos. Não é um brinquedo.',
      fiscais: [
        {
          sku,
          cadastro: {
            sku,
            title: `Colecionável ${sku}`,
            type: 'single' as const,
            measurement_unit: 'UN' as const,
            cost: 1.34,
            tax_information: {
              ncm: '95030039',
              origin_type: 'manufacturer' as const,
              origin_detail: '0',
              csosn: '102',
              net_weight: 0.013,
              gross_weight: 0.023,
            },
          },
        },
      ],
    };
  });
  const entrada: PublicacaoEntrada = {
    modo: 'publicar',
    modelo: 'user_products',
    execucaoId: 'fotos-pendentes',
    produtos: [{ produtoId: 'dragao', precoCentavos: 2290, quantidadeTotal: 20, itens }],
  };
  const anuncios = new Map<string, Record<string, unknown>>();
  const get = vi.fn(async (path: string): Promise<unknown> => {
    if (path === '/users/42') return { id: 42, site_id: 'MLB', tags: ['user_product_seller'] };
    if (path.includes('/items/search?')) {
      const sku = new URL(`https://example.test${path}`).searchParams.get('seller_sku');
      const results = [...anuncios]
        .filter(([, item]) => JSON.stringify(item.attributes).includes(`"${sku}"`))
        .map(([id]) => id);
      return { results, paging: { total: results.length } };
    }
    if (path.startsWith('/user-products/')) return { family_id: '9000' };
    if (path.startsWith('/items/fiscal_information/'))
      return itens.find((item) => item.chave === path.split('/').at(-1))!.fiscais[0]!.cadastro;
    const id = path.split('/')[2]!.split('?')[0]!;
    const indice = Number(id.replace('MLB', '')) - 1000;
    if (path.endsWith('/description')) return { plain_text: itens[indice]!.descricao };
    if (path.endsWith('/fiscal_information/detail'))
      return {
        item_id: id,
        seller_id: 42,
        sku: { ...itens[indice]!.fiscais[0]!.cadastro, can_invoice: true },
      };
    if (path.startsWith('/items/')) return anuncios.get(id);
    throw new Error('Rota não simulada');
  });
  const post = vi.fn(async (path: string, body: unknown): Promise<unknown> => {
    if (path === '/items/validate') return {};
    if (path !== '/items') throw new Error('Mutação não esperada');
    const indice = anuncios.size;
    const id = `MLB${1000 + indice}`;
    const item = {
      ...objeto(body),
      id,
      seller_id: 42,
      user_product_id: `MLBU${1000 + indice}`,
      status: indice === 0 ? status : 'active',
      sub_status: indice === 0 ? subStatus : [],
    };
    anuncios.set(id, item);
    return item;
  });
  const put = vi.fn();
  const http = { sellerId: '42', get, post, put } as unknown as MercadoLivreHttpService;
  const repositorio = {
    carregar: vi.fn(async () => [
      {
        id: 'dragao',
        ativo: true,
        precoCentavos: 2290,
        variacoes: itens.map((item) => ({
          sku: item.chave,
          ativo: true,
          precoCentavos: 2290,
          pesoG: 13,
          filamentoId: 'PLA',
          filamentoAtivo: true,
          estoqueGramas: 1000,
        })),
      },
    ]),
    registrar: vi.fn(),
  };
  const salvo: JournalPublicacao = {
    versao: 1,
    execucaoId: entrada.execucaoId,
    hash: 'hash-estavel',
    itens: {},
  };
  const journal = {
    adquirir: vi.fn(async () => vi.fn()),
    carregar: vi.fn(async () => salvo),
    salvar: vi.fn(),
  };
  return {
    entrada,
    anuncios,
    post,
    put,
    get,
    repositorio,
    salvo,
    service: new PublicacaoService(http, repositorio, journal as unknown as PublicacaoJournal),
  };
}

describe('Processamento temporário das fotos do anúncio', () => {
  it('continua as sete cores, confirma família e mantém o ERP incompleto até as fotos serem aprovadas', async () => {
    const contexto = preparar('paused', ['picture_download_pending']);
    const resultado = await contexto.service.executar(contexto.entrada);
    expect(contexto.post.mock.calls.filter(([path]) => path === '/items')).toHaveLength(7);
    expect(resultado).toMatchObject({
      pendentes: [{ chave: 'DRAG-COR-0', itemId: 'MLB1000', motivo: 'processamento_fotos' }],
    });
    expect(contexto.salvo.itens['DRAG-COR-0']).toMatchObject({
      verificado: false,
      familyId: '9000',
      fiscalConfirmado: true,
      descricaoConfirmada: true,
    });
    expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
      'dragao',
      expect.objectContaining({ status: 'incompleto' }),
    );
    expect(contexto.put).not.toHaveBeenCalled();

    contexto.anuncios.get('MLB1000')!.status = 'active';
    contexto.anuncios.get('MLB1000')!.sub_status = [];
    const retomado = await contexto.service.executar({ ...contexto.entrada, modo: 'retomar' });
    expect(retomado).toMatchObject({ pendentes: [] });
    expect(contexto.post.mock.calls.filter(([path]) => path === '/items')).toHaveLength(7);
    expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
      'dragao',
      expect.objectContaining({ status: 'concluido' }),
    );
    expect(contexto.put).not.toHaveBeenCalled();
  });

  it.each([
    ['under_review', ['picture_download_pending']],
    ['paused', ['picture_download_pending', 'other']],
    ['paused', []],
  ])('bloqueia o lote no estado %s com substatus %j', async (status, subStatus) => {
    const contexto = preparar(status, subStatus);
    await expect(contexto.service.executar(contexto.entrada)).rejects.toThrow(
      'ainda não está ativo',
    );
    expect(contexto.post.mock.calls.filter(([path]) => path === '/items')).toHaveLength(1);
    expect(contexto.salvo.itens['DRAG-COR-0']?.verificado).toBe(false);
    expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
      'dragao',
      expect.objectContaining({ status: 'incompleto' }),
    );
    expect(contexto.put).not.toHaveBeenCalled();
  });
});
