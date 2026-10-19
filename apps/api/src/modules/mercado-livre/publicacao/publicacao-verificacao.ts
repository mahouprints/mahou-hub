import type { PublicacaoItem, ObjetoMl } from './publicacao-schema';
import type { RegistroItem } from './publicacao-journal';
import { PublicacaoErro } from './publicacao-erro';

/** Lê apenas objetos JSON; ex.: resposta do item antes da comparação. */
export function objeto(valor: unknown): ObjetoMl {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as ObjetoMl)
    : {};
}

/** Compara campos enviados sem exigir igualdade com metadados acrescentados pelo ML. */
export function contemCampos(recebido: unknown, esperado: unknown): boolean {
  if (Array.isArray(esperado))
    return (
      Array.isArray(recebido) &&
      esperado.every((item) => recebido.some((atual) => contemCampos(atual, item)))
    );
  if (esperado !== null && typeof esperado === 'object')
    return Object.entries(objeto(esperado)).every(([campo, valor]) => {
      const atual = objeto(recebido)[campo];
      // A API serializa estes decimais fiscais como texto; códigos preservam igualdade estrita.
      if (
        ['cost', 'net_weight', 'gross_weight'].includes(campo) &&
        typeof valor === 'number' &&
        typeof atual === 'string' &&
        /^\d+(?:\.\d+)?$/.test(atual)
      )
        return Number(atual) === valor;
      return contemCampos(atual, valor);
    });
  return recebido === esperado;
}

/** Reconhece o vínculo fiscal mesmo quando a API envolve a coleção em um objeto. */
export function contemVinculo(recebido: unknown, sku: string, variationId?: string): boolean {
  if (Array.isArray(recebido))
    return recebido.some((valor) => contemVinculo(valor, sku, variationId));
  const atual = objeto(recebido);
  if (atual.sku === sku && (!variationId || String(atual.variation_id) === variationId))
    return true;
  return Object.values(atual).some(
    (valor) =>
      valor !== null && typeof valor === 'object' && contemVinculo(valor, sku, variationId),
  );
}

function atributosConferem(recebidos: unknown, esperados: unknown): boolean {
  if (!Array.isArray(esperados) || !Array.isArray(recebidos)) return false;
  return esperados.every((atributo) => {
    const valor = objeto(atributo);
    return recebidos.some((recebido) => {
      const atual = objeto(recebido);
      return (
        atual.id === valor.id &&
        (valor.value_id ? atual.value_id === valor.value_id : atual.value_name === valor.value_name)
      );
    });
  });
}

/** Confere propriedade, preço, estoque, atributos e todas as cores no item remoto. */
export function verificarItem(
  recebido: unknown,
  esperado: PublicacaoItem,
  sellerId: string,
): RegistroItem {
  const atual = objeto(recebido);
  const payload = esperado.payload;
  if (!/^MLB\d+$/.test(String(atual.id)) || String(atual.seller_id) !== sellerId)
    throw new PublicacaoErro('Anúncio sem identidade/propriedade esperada.');
  for (const campo of ['category_id', 'currency_id', 'listing_type_id', 'condition'] as const) {
    if (atual[campo] !== payload[campo])
      throw new PublicacaoErro('Condições do anúncio divergentes do plano.');
  }
  if (!atributosConferem(atual.attributes, payload.attributes))
    throw new PublicacaoErro('Atributos do anúncio divergentes.');
  if (!Array.isArray(atual.pictures) || atual.pictures.length < payload.pictures.length)
    throw new PublicacaoErro('Imagens do anúncio incompletas.');
  if (payload.shipping && !contemCampos(atual.shipping, payload.shipping))
    throw new PublicacaoErro('Envio do anúncio divergente.');
  const variationIds: Record<string, string> = {};
  const ofertas = payload.variations ?? [payload];
  const remotas =
    Array.isArray(atual.variations) && payload.variations ? atual.variations : [atual];
  if (remotas.length !== ofertas.length)
    throw new PublicacaoErro('Quantidade de cores divergente.');
  for (const oferta of ofertas) {
    const sku = oferta.attributes.find((atributo) => atributo.id === 'SELLER_SKU')?.value_name;
    const remoto = remotas
      .map(objeto)
      .find(
        (cor) =>
          Array.isArray(cor.attributes) &&
          cor.attributes.some(
            (atributo) =>
              objeto(atributo).id === 'SELLER_SKU' && objeto(atributo).value_name === sku,
          ),
      );
    if (
      !remoto ||
      Math.round(Number(remoto.price) * 100) !== Math.round(Number(oferta.price) * 100) ||
      remoto.available_quantity !== oferta.available_quantity
    )
      throw new PublicacaoErro('SKU, preço ou quantidade do anúncio divergente.');
    if (
      'attribute_combinations' in oferta &&
      !atributosConferem(remoto.attribute_combinations, oferta.attribute_combinations)
    )
      throw new PublicacaoErro('Cor anunciada divergente.');
    if (payload.variations && sku) variationIds[sku] = String(remoto.id);
  }
  return {
    estado: 'CRIADO',
    itemId: String(atual.id),
    variationIds,
    ...(atual.user_product_id ? { userProductId: String(atual.user_product_id) } : {}),
    ...(atual.family_id ? { familyId: String(atual.family_id) } : {}),
    ...(typeof atual.permalink === 'string' &&
    /^https:\/\/[^/]*mercadolivre\.com\.br\//.test(atual.permalink)
      ? { permalink: atual.permalink }
      : {}),
  };
}

/** Requer aptidão fiscal de todas as variações; ex.: resposta can_invoice autenticada. */
export function aptoParaFaturar(resposta: unknown, itemId: string, sellerId: string): boolean {
  const linhas = Array.isArray(resposta) ? resposta : [resposta];
  return (
    linhas.length > 0 &&
    linhas.every((linha) => {
      const valor = objeto(linha);
      return (
        valor.item_id === itemId && String(valor.seller_id) === sellerId && valor.status === true
      );
    })
  );
}
