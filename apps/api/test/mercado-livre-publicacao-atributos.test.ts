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
