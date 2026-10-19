import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';
import type { PublicacaoItem } from '../src/modules/mercado-livre/publicacao/publicacao-schema';
import type {
  JournalPublicacao,
  PublicacaoJournal,
} from '../src/modules/mercado-livre/publicacao/publicacao-journal';
import { reconciliarPacotePublicacao } from '../src/modules/mercado-livre/publicacao/publicacao-pacote';
import { PublicacaoService } from '../src/modules/mercado-livre/publicacao/publicacao.service';

const pacote = [
  { id: 'SELLER_PACKAGE_HEIGHT', value_name: '2 cm' },
  { id: 'SELLER_PACKAGE_WIDTH', value_name: '15 cm' },
  { id: 'SELLER_PACKAGE_LENGTH', value_name: '20 cm' },
  { id: 'SELLER_PACKAGE_WEIGHT', value_name: '23 g' },
];
const item: PublicacaoItem = {
  chave: 'DRAG-BR',
  skus: [{ sku: 'DRAG-BR', quantidade: 20 }],
  payload: {
    family_name: 'Mini dragão colecionável',
    category_id: 'MLB1839',
    currency_id: 'BRL',
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special',
    condition: 'new',
    price: 22.9,
    available_quantity: 20,
    pictures: [{ source: 'https://media.mahouprints.com/foto.jpg' }],
    attributes: [{ id: 'SELLER_SKU', value_name: 'DRAG-BR' }, ...pacote],
    shipping: { mode: 'me2', free_shipping: true },
  },
  descricao: 'Colecionável para maiores de 14 anos. Não é um brinquedo.',
  fiscais: [],
};
const confirmado = {
  ...item.payload,
  id: 'MLB123',
  seller_id: 42,
  user_product_id: 'MLBU123',
  status: 'active',
};
const alterado = {
  ...confirmado,
  attributes: [
    item.payload.attributes[0],
    ...pacote.map((atributo) => ({
      ...atributo,
      value_name: atributo.id === 'SELLER_PACKAGE_WEIGHT' ? '850 g' : '18 cm',
    })),
  ],
};
function preparar(resposta: unknown = confirmado) {
  const get = vi.fn().mockResolvedValue(resposta);
  const put = vi.fn().mockResolvedValue(undefined);
  const http = { sellerId: '42', get, put } as unknown as MercadoLivreHttpService;
  return { http, get, put };
}

describe('Correção restrita do pacote de User Product', () => {
  it('corrige apenas os quatro atributos autorizados e confirma por GET sem alterar plano', async () => {
    const { http, get, put } = preparar();
    const original = structuredClone(item);
    expect(await reconciliarPacotePublicacao(http, 'MLB123', item, alterado)).toEqual(confirmado);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/items/MLB123', { attributes: pacote });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/items/MLB123?include_attributes=all');
    expect(item).toEqual(original);
  });

  it('não grava quando o pacote já confere', async () => {
    const { http, get, put } = preparar();
    expect(await reconciliarPacotePublicacao(http, 'MLB123', item, confirmado)).toEqual(confirmado);
    expect(put).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    { id: 'MLB999' },
    { seller_id: 99 },
    { price: 25.9 },
    { category_id: 'MLB999' },
    { attributes: [{ id: 'SELLER_SKU', value_name: 'OUTRO' }, ...alterado.attributes.slice(1)] },
    { pictures: [] },
    { shipping: { mode: 'me2', free_shipping: false } },
    { status: 'under_review', sub_status: ['picture_download_pending'] },
    { status: 'paused', sub_status: ['picture_download_pending', 'held'] },
    { user_product_id: null },
  ])('não modifica pacote quando outro dado diverge: %j', async (mudanca) => {
    const { http, put } = preparar();
    await expect(
      reconciliarPacotePublicacao(http, 'MLB123', item, { ...alterado, ...mudanca }),
    ).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });

  it('permite a correção durante a pausa exclusiva de download sem alterar status', async () => {
    const pendente = { status: 'paused', sub_status: ['picture_download_pending'] };
    const { http, put } = preparar({ ...confirmado, ...pendente });
    await reconciliarPacotePublicacao(http, 'MLB123', item, { ...alterado, ...pendente });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/items/MLB123', { attributes: pacote });
  });

  it('não corrige se o plano não contém os quatro valores válidos', async () => {
    const { http, put } = preparar();
    const incompleto = {
      ...item,
      payload: { ...item.payload, attributes: item.payload.attributes.slice(0, -1) },
    };
    await expect(reconciliarPacotePublicacao(http, 'MLB123', incompleto, alterado)).rejects.toThrow(
      'sem condições',
    );
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    alterado,
    { ...confirmado, seller_id: 99 },
    { ...confirmado, user_product_id: 'MLBU999' },
  ])('não aceita resposta ainda divergente após o PUT: %j', async (resposta) => {
    const { http, put } = preparar(resposta);
    await expect(reconciliarPacotePublicacao(http, 'MLB123', item, alterado)).rejects.toThrow();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('não repete PUT quando há timeout e permite somente releitura em execução posterior', async () => {
    const { http, put, get } = preparar();
    put.mockRejectedValueOnce(new Error('timeout'));
    await expect(reconciliarPacotePublicacao(http, 'MLB123', item, alterado)).rejects.toThrow(
      'timeout',
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
    await reconciliarPacotePublicacao(http, 'MLB123', item, confirmado);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('preserva ID e verificado false no journal quando a correção não é confirmada', async () => {
    const { http, put } = preparar(alterado);
    const post = vi.fn();
    const salvo: JournalPublicacao = {
      versao: 1,
      execucaoId: 'pacote',
      hash: 'hash',
      itens: { 'DRAG-BR': { estado: 'CRIADO', itemId: 'MLB123', verificado: true } },
    };
    const salvar = vi.fn();
    const service = new PublicacaoService(
      { sellerId: http.sellerId, get: http.get, put: http.put, post },
      { carregar: vi.fn(), registrar: vi.fn() },
      { salvar } as unknown as PublicacaoJournal,
    );
    const publicar = service as unknown as {
      publicarItem(
        esperado: PublicacaoItem,
        journal: JournalPublicacao,
        modo: 'retomar',
      ): Promise<void>;
    };
    await expect(publicar.publicarItem(item, salvo, 'retomar')).rejects.toThrow('Atributos');
    expect(salvo.itens['DRAG-BR']).toMatchObject({ itemId: 'MLB123', verificado: false });
    expect(put).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    expect(salvar).toHaveBeenCalled();
  });
});
