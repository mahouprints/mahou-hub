import 'reflect-metadata';
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';
import { formatarErroPublicacao } from '../src/modules/mercado-livre/publicacao/publicacao-erro';
import type { PrismaService } from '../src/prisma/prisma.service';

const proibido = {
  error: 'forbidden',
  error_code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',
  message: 'Dados livres de Maria, token ACCESS_SECRET',
  access_token: 'ACCESS_SECRET',
  cause: [
    {
      code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',
      type: 'error',
      references: ['tax_information.ncm'],
      message: 'Maria ACCESS_SECRET',
    },
    {
      code: 'ACCESS_SECRET',
      type: 'texto privado',
      references: ['ACCESS_SECRET', 'CPF 123.456.789-00'],
    },
  ],
};

function preparar(corpo: unknown = proibido) {
  const tx = {
    $executeRaw: vi.fn(),
    mercadoLivreToken: {
      findUnique: vi.fn(async () => ({
        accessToken: 'ACCESS_SECRET',
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
    ML_SECRET_KEY: 'CLIENT_SECRET',
  });
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(corpo), { status: 403 }));
  vi.stubGlobal('fetch', fetchMock);
  return { service: new MercadoLivreHttpService(config, prisma), fetchMock };
}

afterEach(() => vi.unstubAllGlobals());

describe('Diagnóstico fiscal Mercado Livre', () => {
  it.each([
    '/items/fiscal_information/DRAG-MINI-BRANCO',
    '/items/MLB123/fiscal_information/detail',
    '/can_invoice/items/MLB123',
  ])('identifica 403 em GET %s sem token, query ou corpo livre', async (path) => {
    const { service, fetchMock } = preparar();
    const erro = await service
      .get<never>(`${path}?access_token=ACCESS_SECRET&cpf=12345678900`)
      .catch((falha: BadGatewayException) => falha);
    const resultado = formatarErroPublicacao(erro);
    expect(resultado).toMatchObject({
      mercadoLivreStatus: 403,
      mercadoLivreOperacao: 'GET',
      mercadoLivreCaminho: path,
      mercadoLivreCausas: {
        error: 'forbidden',
        error_code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',
        cause: [
          {
            code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES',
            type: 'error',
            references: ['tax_information.ncm'],
          },
        ],
      },
    });
    expect(JSON.stringify(resultado)).not.toMatch(
      /ACCESS_SECRET|CLIENT_SECRET|Maria|123456|123\.456|Dados livres|access_token/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/orders/123',
    '/items/fiscal_information/ACCESS_SECRET',
    '/items/fiscal_information/nome%20livre',
  ])('não expõe contexto nem diagnóstico fora de rota segura: %s', async (path) => {
    const { service } = preparar();
    const erro = await service.get<never>(path).catch((falha: BadGatewayException) => falha);
    const resultado = formatarErroPublicacao(erro);
    expect(resultado).not.toHaveProperty('mercadoLivreCaminho');
    expect(resultado).not.toHaveProperty('mercadoLivreCausas');
  });

  it('filtra contexto inválido recebido pela formatação final', () => {
    const erro = new BadGatewayException({
      mercadoLivreStatus: 403,
      mercadoLivreOperacao: 'GET ACCESS_SECRET',
      mercadoLivreCaminho: '/orders/123?access_token=ACCESS_SECRET',
      message: 'ACCESS_SECRET',
    });
    expect(JSON.stringify(formatarErroPublicacao(erro))).not.toContain('ACCESS_SECRET');
    expect(formatarErroPublicacao(erro)).not.toHaveProperty('mercadoLivreCaminho');
  });

  it('preserva código fiscal numérico textual sem mensagem livre', async () => {
    const { service } = preparar({ error_code: '10095', message: 'Item e comprador privados' });
    const erro = await service
      .get<never>('/items/MLB123/fiscal_information/detail')
      .catch((falha: BadGatewayException) => falha);
    expect(formatarErroPublicacao(erro).mercadoLivreCausas).toEqual({
      error_code: '10095',
      cause: [],
    });
  });
});
