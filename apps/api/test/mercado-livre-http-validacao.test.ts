import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const aviso = {
  type: 'warning',
  code: 'shipping.lost_me1_by_user',
  references: ['user.shipping_preferences.modes'],
  message: 'Dados livres privados access-test',
};

function preparar(cause: unknown, status = 400, error = 'validation_error') {
  const tx = {
    $executeRaw: vi.fn(),
    mercadoLivreToken: {
      findUnique: vi.fn(async () => ({
        accessToken: 'access-test',
        expiraEm: new Date(Date.now() + 600_000),
      })),
    },
  };
  const prisma = {
    $transaction: async (operacao: (atual: typeof tx) => Promise<string>) => operacao(tx),
  } as unknown as PrismaService;
  const config = new ConfigService({
    ML_SELLER_ID: '42',
    ML_APP_ID: 'app',
    ML_SECRET_KEY: 'secret',
  });
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ error, cause, message: 'Resposta livre privada' }), { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return { service: new MercadoLivreHttpService(config, prisma), fetchMock };
}

afterEach(() => vi.unstubAllGlobals());

describe('Avisos não bloqueantes no validador de anúncios', () => {
  it('aceita HTTP 400 com somente warnings e retorna apenas diagnóstico sanitizado', async () => {
    const { service, fetchMock } = preparar([aviso]);
    await expect(service.post('/items/validate', {})).resolves.toEqual({
      error: 'validation_error',
      cause: [
        {
          type: 'warning',
          code: 'shipping.lost_me1_by_user',
          references: ['user.shipping_preferences.modes'],
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [aviso, { type: 'error', code: 'item.required' }],
    [aviso, { type: 'unknown' }],
    [aviso, { code: 'item.required' }],
    [aviso, null],
    [],
    [...Array(20).fill(aviso), { type: 'error', code: 'item.required' }],
  ])('bloqueia qualquer erro ou causa desconhecida no corpo original: %j', async (...causas) => {
    const { service } = preparar(causas);
    await expect(service.post('/items/validate', {})).rejects.toThrow('HTTP 400');
  });

  it.each([
    ['post', '/items', 400, 'validation_error'],
    ['put', '/items/validate', 400, 'validation_error'],
    ['post', '/items/validate', 500, 'validation_error'],
    ['post', '/items/validate', 400, 'other_error'],
    ['post', '/items/validate?other=true', 400, 'validation_error'],
  ] as const)('preserva falha em %s %s HTTP %i com %s', async (metodo, path, status, error) => {
    const { service } = preparar([aviso], status, error);
    await expect(service[metodo](path, {})).rejects.toThrow(`HTTP ${status}`);
  });
});
