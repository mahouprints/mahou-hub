import { createHash } from 'node:crypto';

/**
 * Assinatura da Shopee Affiliate Open Platform.
 * SHA256(AppId + Timestamp + Payload + Secret) — hex lowercase.
 * `Timestamp` em segundos epoch. `Payload` é o corpo JSON exatamente como será enviado.
 *
 * Header gerado: `Authorization: SHA256 Credential={AppId}, Signature={hex}, Timestamp={Timestamp}`.
 */
export function signRequest(
  appId: string,
  secret: string,
  payload: string,
  timestamp: number,
): string {
  return createHash('sha256').update(`${appId}${timestamp}${payload}${secret}`).digest('hex');
}

export function buildAuthorizationHeader(
  appId: string,
  signature: string,
  timestamp: number,
): string {
  return `SHA256 Credential=${appId}, Signature=${signature}, Timestamp=${timestamp}`;
}
