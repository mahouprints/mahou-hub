import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { buildAuthorizationHeader, signRequest } from './signature.util';

describe('signRequest', () => {
  it('replica a fórmula SHA256(AppId + Timestamp + Payload + Secret)', () => {
    const appId = '18376711101';
    const secret = 'FLLFUFQYKB3247GYRIFDMD6OTBFV2G7P';
    const payload = JSON.stringify({ query: '{ ping }', variables: {} });
    const timestamp = 1700000000;

    const esperado = createHash('sha256')
      .update(`${appId}${timestamp}${payload}${secret}`)
      .digest('hex');
    expect(signRequest(appId, secret, payload, timestamp)).toBe(esperado);
  });

  it('produz assinaturas distintas pra timestamps distintos', () => {
    const a = signRequest('app', 'sec', 'body', 1);
    const b = signRequest('app', 'sec', 'body', 2);
    expect(a).not.toBe(b);
  });

  it('é estável: mesma entrada gera o mesmo digest', () => {
    const a = signRequest('app', 'sec', 'body', 123);
    const b = signRequest('app', 'sec', 'body', 123);
    expect(a).toBe(b);
  });
});

describe('buildAuthorizationHeader', () => {
  it('formata no padrão exigido pela Shopee', () => {
    expect(buildAuthorizationHeader('APP', 'abc123', 1700000000)).toBe(
      'SHA256 Credential=APP, Signature=abc123, Timestamp=1700000000',
    );
  });
});
