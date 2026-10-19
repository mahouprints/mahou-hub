import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException } from '@nestjs/common';
import { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';
import type { PrismaService } from '../src/prisma/prisma.service';

type TokenSalvo = { sellerId: string; accessToken: string; refreshToken: string; expiraEm: Date };

function preparar() {
  let token: TokenSalvo | null = null;
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    mercadoLivreToken: {
      findUnique: vi.fn(async () => token),
      upsert: vi.fn(async ({ create }: { create: TokenSalvo }) => {
        token = create;
        return token;
      }),
    },
  };
  const prisma = {
    $transaction: async (callback: (txMock: typeof tx) => Promise<string>) => callback(tx),
  } as unknown as PrismaService;
  const config = new ConfigService({
    ML_SELLER_ID: '42',
    ML_APP_ID: 'app-test',
    ML_SECRET_KEY: 'secret-test',
    ML_REFRESH_TOKEN: 'bootstrap-test',
  });
  const fetchMock = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/oauth/token')
            ? { access_token: 'access-test', refresh_token: 'rotated-test', expires_in: 21600 }
            : { resultado: 'ok' },
        ),
        { status: 200 },
      ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return {
    service: new MercadoLivreHttpService(config, prisma),
    tx,
    prisma,
    config,
    fetchMock,
    tokenAtual: () => token,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('OAuth Mercado Livre persistido', () => {
  it('preserva family_id maior que MAX_SAFE_INTEGER sem alterar outros números ou textos', async () => {
    const { service, fetchMock } = preparar();
    await service.get('/items/MLB1');
    fetchMock.mockResolvedValueOnce(
      new Response(
        '{"family_id":5896969823350698505,"stock":20,"name":"family_id:5896969823350698505"}',
      ),
    );
    fetchMock.mockResolvedValueOnce(new Response('{"family_id":5896969823350698506}'));
    const primeira = await service.get<{ family_id: string; stock: number; name: string }>(
      '/user-products/MLBU1',
    );
    const segunda = await service.get<{ family_id: string }>('/user-products/MLBU2');
    expect(primeira).toEqual({
      family_id: '5896969823350698505',
      stock: 20,
      name: 'family_id:5896969823350698505',
    });
    expect(segunda.family_id).toBe('5896969823350698506');
    expect(primeira.family_id).not.toBe(segunda.family_id);
  });

  it('persiste refresh rotativo e usa access token salvo depois de reiniciar o cliente', async () => {
    const { service, tx, prisma, config, fetchMock, tokenAtual } = preparar();
    await service.get('/items/MLB123');
    expect(tokenAtual()?.refreshToken).toBe('rotated-test');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    await new MercadoLivreHttpService(config, prisma).get('/items/MLB456');
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/oauth/token'))).toHaveLength(1);
    expect(tx.mercadoLivreToken.upsert).toHaveBeenCalledTimes(1);
  });

  it('coalesce chamadas concorrentes em uma única renovação', async () => {
    const { service, fetchMock } = preparar();
    await Promise.all([service.get('/items/MLB1'), service.get('/items/MLB2')]);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/oauth/token'))).toHaveLength(1);
  });

  it('renovação após expiração usa refresh persistido, nunca o bootstrap antigo', async () => {
    const { service, prisma, config, fetchMock, tokenAtual } = preparar();
    await service.get('/items/MLB1');
    tokenAtual()!.expiraEm = new Date(0);
    let refreshEnviado = '';
    fetchMock.mockImplementationOnce(async (_url, ...rest: unknown[]) => {
      const init = rest[0] as RequestInit;
      refreshEnviado = String((init.body as URLSearchParams).get('refresh_token'));
      return new Response(
        JSON.stringify({
          access_token: 'next-access',
          refresh_token: 'next-refresh',
          expires_in: 21600,
        }),
      );
    });
    await new MercadoLivreHttpService(config, prisma).get('/items/MLB2');
    expect(refreshEnviado).toBe('rotated-test');
  });

  it('não propaga corpo de erro contendo credenciais', async () => {
    const { service, fetchMock } = preparar();
    fetchMock.mockResolvedValueOnce(new Response('secret-test bootstrap-test', { status: 400 }));
    const erro = await service.get('/items/MLB1').catch((falha: Error) => falha.message);
    expect(erro).toContain('HTTP 400');
    expect(erro).not.toContain('secret-test');
    expect(erro).not.toContain('bootstrap-test');
  });

  it('sanitiza falha de persistência que possa carregar tokens nos argumentos', async () => {
    const { service, tx } = preparar();
    tx.mercadoLivreToken.upsert.mockRejectedValueOnce(new Error('refreshToken: rotated-test'));
    const erro = await service.get('/items/MLB1').catch((falha: Error) => falha.message);
    expect(erro).toContain('persistir');
    expect(erro).not.toContain('rotated-test');
  });

  it('rejeita payload OAuth malformado antes de persistir', async () => {
    const { service, tx, fetchMock } = preparar();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: {}, refresh_token: 'rotated-test', expires_in: 21600 }),
      ),
    );
    await expect(service.get('/items/MLB1')).rejects.toThrow('credenciais incompletas');
    expect(tx.mercadoLivreToken.upsert).not.toHaveBeenCalled();
  });
});

describe('Gravações Mercado Livre', () => {
  it.each(['post', 'put'] as const)(
    'envia %s autenticado com JSON uma única vez',
    async (method) => {
      const { service, fetchMock } = preparar();
      const payload = { title: 'Figura colecionável', price: 22.9 };
      await expect(service[method]('/items', payload)).resolves.toEqual({ resultado: 'ok' });
      expect(fetchMock).toHaveBeenLastCalledWith(
        'https://api.mercadolibre.com/items',
        expect.objectContaining({
          method: method.toUpperCase(),
          body: JSON.stringify(payload),
          headers: {
            Authorization: 'Bearer access-test',
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          signal: expect.any(AbortSignal),
        }),
      );
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/items'))).toHaveLength(1);
    },
  );

  it.each(['post', 'put'] as const)('aceita HTTP 204 em %s', async (method) => {
    const { service, fetchMock } = preparar();
    await service.get('/users/me');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(service[method]('/items/MLB123/description', {})).resolves.toBeUndefined();
  });

  it('mantém HTTP 204 como consulta ainda sem conteúdo', async () => {
    const { service, fetchMock } = preparar();
    await service.get('/users/me');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(service.get('/items/MLB123')).rejects.toThrow('ainda sem conteúdo');
  });

  it.each(['post', 'put'] as const)(
    'não repete %s após timeout e remove detalhes da falha',
    async (method) => {
      const { service, fetchMock } = preparar();
      await service.get('/users/me');
      fetchMock.mockClear();
      fetchMock.mockRejectedValueOnce(new Error('timeout Authorization: Bearer access-test'));
      const erro = await service[method]('/items', {}).catch((falha: Error) => falha.message);
      expect(erro).toBe('Não foi possível confirmar a resposta do Mercado Livre.');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('não propaga corpo de erro da publicação nem repete HTTP 500', async () => {
    const { service, fetchMock } = preparar();
    await service.get('/users/me');
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(new Response('access-test e dados privados', { status: 500 }));
    await expect(service.post('/items', {})).rejects.toThrow('Gravação Mercado Livre: HTTP 500.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('expõe apenas o status HTTP para distinguir recurso inexistente', async () => {
    const { service, fetchMock } = preparar();
    await service.get('/users/me');
    fetchMock.mockResolvedValueOnce(new Response('access-test', { status: 404 }));
    await expect(service.get('/items/MLB123/fiscal_information')).rejects.toMatchObject({
      response: {
        statusCode: 502,
        mercadoLivreStatus: 404,
        message: 'Consulta Mercado Livre: HTTP 404.',
      },
    });
  });

  it.each(['post', 'put'] as const)(
    'expõe somente causas sanitizadas de %s em anúncios',
    async (method) => {
      const { service, fetchMock, tokenAtual } = preparar();
      await service.get('/users/me');
      tokenAtual()!.accessToken = 'access_test';
      fetchMock.mockClear();
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'validation_error',
            message: 'Token access_test; comprador Maria, CPF 123.456.789-00',
            access_token: 'access_test',
            cause: [
              {
                code: 'item.attributes.missing_required',
                type: 'error',
                references: ['item.attributes', 'variations[0].attributes'],
                message: 'Falta valor privado',
                value: 'Maria',
              },
              {
                code: 'access_test',
                type: 'comprador Maria',
                references: ['access_test', 'CPF 123.456.789-00', 'a'.repeat(121)],
              },
              {
                code: 'body.invalid_fields',
                type: 'warning',
                references: ['price'],
                private: { token: 'access_test' },
              },
            ],
          }),
          { status: 400 },
        ),
      );
      const erro = await service[method]<never>('/items/validate', {}).catch(
        (falha: BadGatewayException) => falha,
      );
      expect(erro.getResponse()).toEqual({
        statusCode: 502,
        mercadoLivreStatus: 400,
        mercadoLivreOperacao: method.toUpperCase(),
        mercadoLivreCaminho: '/items/validate',
        message: 'Gravação Mercado Livre: HTTP 400.',
        mercadoLivreCausas: {
          error: 'validation_error',
          cause: [
            {
              code: 'item.attributes.missing_required',
              type: 'error',
              references: ['item.attributes', 'variations[0].attributes'],
            },
            { code: 'body.invalid_fields', type: 'warning', references: ['price'] },
          ],
        },
      });
      expect(JSON.stringify(erro.getResponse())).not.toMatch(/access_test|Maria|123\.456|privado/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['get', '/items/MLB123'],
    ['post', '/orders'],
    ['put', '/users/42'],
  ] as const)('não lê causas em %s %s', async (method, path) => {
    const { service, fetchMock } = preparar();
    await service.get('/users/me');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'validation_error', cause: [{ code: 'item.invalid' }] }),
        { status: 400 },
      ),
    );
    const erro = await service[method]<never>(path, {}).catch(
      (falha: BadGatewayException) => falha,
    );
    expect(erro.getResponse()).not.toHaveProperty('mercadoLivreCausas');
  });

  it('limita quantidade de causas e referências e mantém falha para JSON inválido', async () => {
    const { service, fetchMock } = preparar();
    await service.get('/users/me');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          cause: Array.from({ length: 30 }, () => ({
            code: 'item.invalid',
            references: Array(15).fill('item.attributes'),
          })),
        }),
        { status: 400 },
      ),
    );
    const erro = await service
      .post<never>('/items', {})
      .catch((falha: BadGatewayException) => falha);
    const resposta = erro.getResponse() as {
      mercadoLivreCausas: { cause: Array<{ references: string[] }> };
    };
    expect(resposta.mercadoLivreCausas.cause).toHaveLength(20);
    expect(resposta.mercadoLivreCausas.cause[0]?.references).toHaveLength(10);
    fetchMock.mockResolvedValueOnce(new Response('access_test resposta inválida', { status: 400 }));
    await expect(service.post('/items', {})).rejects.toThrow('Gravação Mercado Livre: HTTP 400.');
  });

  it.each(['get', 'post', 'put'] as const)(
    'sanitiza JSON inválido na resposta de %s',
    async (method) => {
      const { service, fetchMock } = preparar();
      await service.get('/users/me');
      fetchMock.mockResolvedValueOnce(new Response('access-test resposta inválida'));
      await expect(service[method]('/items', {})).rejects.toThrow(
        'Mercado Livre retornou uma resposta JSON inválida.',
      );
    },
  );
});
