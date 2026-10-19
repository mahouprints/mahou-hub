import type { MercadoLivreHttpService } from '../mercado-livre-http.service';
import type { PublicacaoItem } from './publicacao-schema';
import { PublicacaoErro } from './publicacao-erro';
import { aguardaProcessamentoFotos, objeto, verificarItem } from './publicacao-verificacao';

const atributosPacote = new Set([
  'SELLER_PACKAGE_HEIGHT',
  'SELLER_PACKAGE_WIDTH',
  'SELLER_PACKAGE_LENGTH',
  'SELLER_PACKAGE_WEIGHT',
]);
type HttpPacote = Pick<MercadoLivreHttpService, 'sellerId' | 'get' | 'put'>;

/** Restaura somente o pacote autorizado do UP; ex.: medidas alteradas após a criação. */
export async function reconciliarPacotePublicacao(
  http: HttpPacote,
  itemId: string,
  esperado: PublicacaoItem,
  recebido: unknown,
): Promise<unknown> {
  const atual = objeto(recebido);
  if (atual.id !== itemId) throw new PublicacaoErro('Identidade do anúncio divergente do journal.');
  const pacote = esperado.payload.attributes.filter((atributo) =>
    atributosPacote.has(atributo.id ?? ''),
  );
  if (!pacote.length) return recebido;
  // Antes de qualquer PUT, propriedade, SKU, preço, imagens e demais atributos devem conferir.
  verificarItem(
    recebido,
    {
      ...esperado,
      payload: {
        ...esperado.payload,
        attributes: esperado.payload.attributes.filter(
          (atributo) => !atributosPacote.has(atributo.id ?? ''),
        ),
      },
    },
    http.sellerId,
  );
  const recebidos = Array.isArray(atual.attributes) ? atual.attributes.map(objeto) : [];
  if (
    pacote.every((atributo) =>
      recebidos.some(
        (valor) => valor.id === atributo.id && valor.value_name === atributo.value_name,
      ),
    )
  )
    return recebido;
  if (
    pacote.length !== 4 ||
    new Set(pacote.map((atributo) => atributo.id)).size !== 4 ||
    pacote.some(
      (atributo) =>
        !new RegExp(`^[1-9]\\d* ${atributo.id === 'SELLER_PACKAGE_WEIGHT' ? 'g' : 'cm'}$`).test(
          atributo.value_name ?? '',
        ) || Boolean(atributo.value_id),
    ) ||
    !esperado.payload.family_name ||
    esperado.payload.variations ||
    !/^MLBU\d+$/.test(String(atual.user_product_id)) ||
    (atual.status !== 'active' && !aguardaProcessamentoFotos(atual))
  )
    throw new PublicacaoErro('Pacote divergente sem condições para correção automática.');
  // SELLER_PACKAGE_* são editáveis via /items; PACKAGE_* internos nunca são modificados.
  await http.put(`/items/${itemId}`, {
    attributes: pacote.map(({ id, value_name }) => ({ id, value_name })),
  });
  const confirmado = await http.get(`/items/${itemId}?include_attributes=all`);
  if (
    objeto(confirmado).id !== itemId ||
    objeto(confirmado).user_product_id !== atual.user_product_id
  )
    throw new PublicacaoErro('Identidade do anúncio mudou após corrigir o pacote.');
  verificarItem(confirmado, esperado, http.sellerId);
  return confirmado;
}
