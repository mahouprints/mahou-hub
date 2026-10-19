import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  PublicacaoEntradaSchema,
  type PublicacaoItem,
} from '../src/modules/mercado-livre/publicacao/publicacao-schema';
import { verificarItem } from '../src/modules/mercado-livre/publicacao/publicacao-verificacao';

const item: PublicacaoItem = {
  chave: 'DRAG-BR',
  skus: [{ sku: 'DRAG-BR', quantidade: 8 }],
  descricao: 'Colecionável para maiores de 14 anos.',
  fiscais: [],
  payload: {
    family_name: 'Dragão colecionável',
    category_id: 'MLB1839',
    currency_id: 'BRL',
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special',
    condition: 'new',
    price: 22.9,
    available_quantity: 8,
    pictures: [{ source: 'https://media.mahouprints.com/foto.jpg' }],
    attributes: [
      { id: 'SELLER_SKU', value_name: 'DRAG-BR' },
      { name: 'Cor', value_name: 'Branco Dental' },
    ],
  },
};
const schemaPayload =
  PublicacaoEntradaSchema.shape.produtos.element.shape.itens.element.shape.payload;

describe('Atributos personalizados de User Products', () => {
  it('aceita somente NFC, caixa e espaços em nomes humanos, preservando SKU e IDs', () => {
    const esperado = {
      ...item,
      payload: {
        ...item.payload,
        attributes: [...item.payload.attributes, { id: 'CHARACTER', value_name: 'Mini Dragão' }],
      },
    };
    const remoto = {
      ...esperado.payload,
      id: 'MLB123',
      seller_id: 42,
      attributes: [
        ...item.payload.attributes,
        { id: 'CHARACTER', value_id: '46680506', value_name: ' MINI  draga\u0303o ' },
      ],
    };
    expect(() => verificarItem(remoto, esperado, '42')).not.toThrow();
    expect(() =>
      verificarItem(
        {
          ...remoto,
          attributes: [...item.payload.attributes, { id: 'CHARACTER', value_name: 'Mini dragao' }],
        },
        esperado,
        '42',
      ),
    ).toThrow('Atributos');
    expect(() =>
      verificarItem(
        {
          ...remoto,
          attributes: [{ id: 'SELLER_SKU', value_name: 'drag-br' }, ...remoto.attributes.slice(1)],
        },
        esperado,
        '42',
      ),
    ).toThrow('Atributos');
    const comCodigo = {
      ...esperado,
      payload: {
        ...esperado.payload,
        attributes: [
          { id: 'CHARACTER', value_id: '123', value_name: 'Mini Dragão' },
          ...item.payload.attributes,
        ],
      },
    };
    expect(() => verificarItem(remoto, comCodigo, '42')).toThrow('Atributos');
  });

  it('aceita nome sem id e exige pelo menos uma identidade do atributo', () => {
    expect(schemaPayload.safeParse(item.payload).success).toBe(true);
    expect(
      schemaPayload.safeParse({ ...item.payload, attributes: [{ value_name: 'Branco Dental' }] })
        .success,
    ).toBe(false);
  });

  it('confere atributo personalizado por nome, sem igualar dois ids ausentes', () => {
    const remoto = {
      ...item.payload,
      id: 'MLB123',
      seller_id: 42,
      user_product_id: 'MLBU123',
      status: 'active',
    };
    expect(verificarItem(remoto, item, '42').userProductId).toBe('MLBU123');
    const outroNome = {
      ...remoto,
      attributes: [item.payload.attributes[0], { name: 'Material', value_name: 'Branco Dental' }],
    };
    expect(() => verificarItem(outroNome, item, '42')).toThrow('Atributos');
    const outraCor = {
      ...remoto,
      attributes: [item.payload.attributes[0], { name: 'Cor', value_name: 'Azul' }],
    };
    expect(() => verificarItem(outraCor, item, '42')).toThrow('Atributos');
  });
});
