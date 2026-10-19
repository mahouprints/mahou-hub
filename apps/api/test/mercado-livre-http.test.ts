import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
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
