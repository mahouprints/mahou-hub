import { z } from 'zod';
import { PublicacaoErro } from './publicacao-erro';

const chave = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const sku = z
  .string()
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  .max(24);
const atributo = z
  .object({
    id: z.string().min(1),
    value_id: z.string().nullable().optional(),
    value_name: z.string().nullable().optional(),
  })
  .passthrough();
const variacao = z
  .object({
    price: z.number().positive(),
    available_quantity: z.number().int().positive(),
    attributes: z.array(atributo),
    attribute_combinations: z.array(atributo).min(1),
  })
  .passthrough();
const payload = z
  .object({
    site_id: z.literal('MLB').optional(),
    category_id: z.string().regex(/^MLB\d+$/),
    currency_id: z.literal('BRL'),
    buying_mode: z.literal('buy_it_now'),
    listing_type_id: z.string().min(1),
    condition: z.literal('new'),
    price: z.number().positive().optional(),
    available_quantity: z.number().int().positive().optional(),
    title: z.string().min(1).max(60).optional(),
    family_name: z.string().min(1).optional(),
    pictures: z
      .array(
        z.object({ source: z.string().url().optional(), id: z.string().optional() }).passthrough(),
      )
      .min(1),
    attributes: z.array(atributo),
    variations: z.array(variacao).optional(),
  })
  .passthrough();
export const PublicacaoEntradaSchema = z
  .object({
    modo: z.enum(['validar', 'publicar', 'retomar']),
    execucaoId: chave,
    modelo: z.enum(['legacy', 'user_products']),
    produtos: z
      .array(
        z
          .object({
            produtoId: chave,
            precoCentavos: z.number().int().positive(),
            quantidadeTotal: z.literal(20),
            itens: z
              .array(
                z
                  .object({
                    chave,
                    skus: z
                      .array(z.object({ sku, quantidade: z.number().int().positive() }))
                      .min(1),
                    payload,
                    descricao: z.string().min(30).max(50000),
                    fiscais: z
                      .array(
                        z
                          .object({
                            sku,
                            cadastro: z
                              .object({
                                sku,
                                title: z.string().min(1),
                                type: z.literal('single'),
                                measurement_unit: z.literal('UN'),
                                cost: z.number().nonnegative(),
                                tax_information: z
                                  .object({
                                    ncm: z.string().regex(/^\d{8}$/),
                                    origin_type: z.literal('manufacturer'),
                                    origin_detail: z.string().regex(/^\d$/),
                                    csosn: z.string().regex(/^\d{3}$/),
                                    net_weight: z.number().positive(),
                                    gross_weight: z.number().positive(),
                                  })
                                  .passthrough(),
                              })
                              .strict(),
                          })
                          .strict(),
                      )
                      .min(1),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1)
      .max(2),
  })
  .strict();
export const InspecaoEntradaSchema = z
  .object({
    modo: z.literal('inspecionar'),
    produtoIds: z.array(chave).min(1).max(2),
    categorias: z.array(z.string().regex(/^MLB\d+$/)).max(5),
    skus: z.array(sku).max(14),
    fiscaisSkus: z.array(sku).max(14).default([]),
  })
  .strict();
export type PublicacaoEntrada = z.infer<typeof PublicacaoEntradaSchema>;
export type PublicacaoItem = PublicacaoEntrada['produtos'][number]['itens'][number];
export type PayloadMl = PublicacaoItem['payload'];
export type ObjetoMl = Record<string, unknown>;
export interface CatalogoPublicacao {
  id: string;
  ativo: boolean;
  precoCentavos: number;
  variacoes: Array<{
    sku: string | null;
    ativo: boolean;
    precoCentavos: number;
    pesoG: number;
    filamentoId: string;
    filamentoAtivo: boolean;
    estoqueGramas: number;
  }>;
}

/** Extrai o SKU oficial; ex.: atributos SELLER_SKU de uma cor. */
export function skuDoItem(item: {
  attributes?: Array<{ id?: string; value_name?: string | null }>;
}): string | undefined {
  return item.attributes?.find((atributo) => atributo.id === 'SELLER_SKU')?.value_name ?? undefined;
}

/** Confere a autorização total e a capacidade material antes de qualquer criação. */
export function conferirPlano(
  entrada: PublicacaoEntrada,
  catalogo: CatalogoPublicacao[],
  userProducts: boolean,
): void {
  if ((entrada.modelo === 'user_products') !== userProducts)
    throw new PublicacaoErro('Modelo de publicação incompatível com a conta.');
  const consumo = new Map<string, { gramas: number; estoque: number }>();
  const chaves = new Set<string>();
  const skus = new Set<string>();
  const produtos = new Set<string>();
  for (const produto of entrada.produtos) {
    if (produtos.has(produto.produtoId)) throw new PublicacaoErro('Produto repetido no plano.');
    produtos.add(produto.produtoId);
    const cadastrado = catalogo.find((item) => item.id === produto.produtoId);
    if (!cadastrado?.ativo || cadastrado.precoCentavos !== produto.precoCentavos)
      throw new PublicacaoErro('Produto ou preço divergente do ERP.');
    const ofertas = produto.itens.flatMap((item) => item.skus);
    if (ofertas.length !== 7 || ofertas.reduce((total, item) => total + item.quantidade, 0) !== 20)
      throw new PublicacaoErro('Cada produto exige sete cores e vinte unidades totais.');
    if (!userProducts && produto.itens.length !== 1)
      throw new PublicacaoErro('Legado exige um item por produto.');
    for (const item of produto.itens) {
      if (chaves.has(item.chave)) throw new PublicacaoErro('Chave de item repetida.');
      chaves.add(item.chave);
      conferirPayload(item, produto.precoCentavos, userProducts);
    }
    for (const oferta of ofertas) {
      if (skus.has(oferta.sku)) throw new PublicacaoErro('SKU repetido no plano.');
      skus.add(oferta.sku);
      const cor = cadastrado.variacoes.find((variacao) => variacao.sku === oferta.sku);
      if (
        !cor?.ativo ||
        !cor.filamentoAtivo ||
        cor.precoCentavos !== produto.precoCentavos ||
        cor.pesoG <= 0
      )
        throw new PublicacaoErro('SKU sem material ativo, peso ou preço correspondente no ERP.');
      const anterior = consumo.get(cor.filamentoId)?.gramas ?? 0;
      consumo.set(cor.filamentoId, {
        gramas: anterior + cor.pesoG * oferta.quantidade,
        estoque: cor.estoqueGramas,
      });
    }
  }
  if ([...consumo.values()].some((item) => item.gramas > item.estoque))
    throw new PublicacaoErro('Filamento insuficiente para a soma das ofertas.');
}

function conferirPayload(item: PublicacaoItem, precoCentavos: number, userProducts: boolean): void {
  const corpo = item.payload;
  if (
    userProducts &&
    (!corpo.family_name || corpo.title || corpo.variations || item.skus.length !== 1)
  )
    throw new PublicacaoErro('Payload User Products inválido.');
  if (!userProducts && (!corpo.title || corpo.family_name || corpo.variations?.length !== 7))
    throw new PublicacaoErro('Payload legado inválido.');
  const ofertas = userProducts ? [corpo] : (corpo.variations ?? []);
  for (const oferta of ofertas) {
    const esperado = item.skus.find((cor) => cor.sku === skuDoItem(oferta));
    if (
      !esperado ||
      Math.round((oferta.price ?? 0) * 100) !== precoCentavos ||
      oferta.available_quantity !== esperado.quantidade
    )
      throw new PublicacaoErro('Preço, quantidade ou SKU do payload divergente.');
  }
  if (new Set(ofertas.map(skuDoItem)).size !== item.skus.length)
    throw new PublicacaoErro('SKU duplicado ou ausente no payload.');
  if (JSON.stringify(corpo).includes('{{'))
    throw new PublicacaoErro('Payload contém placeholder não resolvido.');
  if (
    item.fiscais.length !== item.skus.length ||
    new Set(item.fiscais.map((fiscal) => fiscal.sku)).size !== item.skus.length
  )
    throw new PublicacaoErro('Cada SKU exige um cadastro fiscal.');
  for (const fiscal of item.fiscais) {
    if (!item.skus.some((cor) => cor.sku === fiscal.sku) || fiscal.cadastro.sku !== fiscal.sku)
      throw new PublicacaoErro('Cadastro fiscal de SKU divergente.');
    if (
      fiscal.cadastro.tax_information.tax_rule_id ||
      fiscal.cadastro.tax_information.gross_weight < fiscal.cadastro.tax_information.net_weight
    )
      throw new PublicacaoErro('Dados fiscais incompatíveis com Simples ou peso líquido.');
  }
}
