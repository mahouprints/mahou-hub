import type { PedidoStatus } from '@mahou-hub/contracts';

// Tradução do status cru do marketplace pro status interno do Hub.
//
// Guardamos o status cru em `statusExterno` e derivamos o interno aqui, em vez de
// normalizar na importação: cada marketplace tem seu vocabulário, e ter os dois lado a
// lado é o que permite descobrir por que um pedido está num estado inesperado.

/**
 * Status da Shopee Open Platform v2 que significam "já saiu daqui".
 *
 * PROCESSED é o momento em que o vendedor arranjou o envio e a etiqueta foi gerada —
 * na prática a peça já está embalada e a caminho da transportadora, então conta como
 * enviado pro nosso controle de produção. Os seguintes são consequência dele.
 */
const SHOPEE_ENVIADOS = new Set([
  'PROCESSED',
  'SHIPPED',
  'TO_CONFIRM_RECEIVE',
  'COMPLETED',
]);

/** IN_CANCEL é pedido de cancelamento em curso; ainda não é cancelamento consumado. */
const SHOPEE_CANCELADOS = new Set(['CANCELLED', 'TO_RETURN']);

/**
 * Status de ENVIO do Mercado Livre. Vive no recurso de shipment, não no pedido —
 * o `status` do pedido do ML só fala de pagamento (`paid`, `cancelled`), nunca de
 * despacho. Por isso o mapeamento do ML aceita os dois vocabulários.
 */
const ML_ENVIADOS = new Set(['shipped', 'delivered', 'not_delivered']);
const ML_CANCELADOS = new Set(['cancelled', 'invalid']);

/**
 * Traduz o status cru num status do Hub. Devolve `null` quando o status não implica
 * transição — aí o pedido mantém o que já tinha.
 *
 * Devolver null em vez de um default é deliberado: um status desconhecido (a Shopee
 * adiciona status novos sem aviso) não pode reverter um pedido já enviado pra PENDENTE.
 *
 * @example statusInterno('SHOPEE', 'SHIPPED') // 'ENVIADO'
 * @example statusInterno('SHOPEE', 'READY_TO_SHIP') // null — segue como está
 */
export function statusInterno(
  canal: 'SHOPEE' | 'ML',
  statusExterno: string,
): PedidoStatus | null {
  if (canal === 'SHOPEE') {
    const s = statusExterno.toUpperCase();
    if (SHOPEE_ENVIADOS.has(s)) return 'ENVIADO';
    if (SHOPEE_CANCELADOS.has(s)) return 'CANCELADO';
    return null;
  }

  const s = statusExterno.toLowerCase();
  if (ML_ENVIADOS.has(s)) return 'ENVIADO';
  if (ML_CANCELADOS.has(s)) return 'CANCELADO';
  return null;
}

/**
 * Status da Shopee que o sync busca.
 *
 * Não basta READY_TO_SHIP: sem trazer os despachados, um pedido enviado nunca é
 * reimportado e fica congelado como "atendido" no Hub pra sempre.
 */
export const SHOPEE_STATUS_A_SINCRONIZAR = [
  'READY_TO_SHIP',
  'PROCESSED',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
] as const;

/**
 * Um pedido enviado ou cancelado não deve deixar card ativo no kanban.
 * ENVIADO fecha o card; CANCELADO idem — a peça não vai mais ser vendida.
 */
export function statusJobPara(status: PedidoStatus): 'ENVIADO' | 'CANCELADO' | null {
  if (status === 'ENVIADO') return 'ENVIADO';
  if (status === 'CANCELADO') return 'CANCELADO';
  return null;
}
