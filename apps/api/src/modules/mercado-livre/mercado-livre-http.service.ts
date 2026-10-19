import {
  BadGatewayException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

const API = 'https://api.mercadolibre.com';
type TokenOAuth = { access_token: string; refresh_token: string; expires_in: number };

@Injectable()
export class MercadoLivreHttpService {
  private renovacao: Promise<string> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get sellerId(): string {
    return this.config.get<string>('ML_SELLER_ID') ?? '';
  }

  /** Verifica as credenciais estáveis. Ex.: habilitar sincronização configurada. */
  estaConfigurado(): boolean {
    return Boolean(
      this.sellerId && this.config.get('ML_APP_ID') && this.config.get('ML_SECRET_KEY'),
    );
  }

  /** Consulta um recurso autenticado do vendedor. Ex.: get('/orders/123'). */
  async get<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    if (!this.estaConfigurado())
      throw new ServiceUnavailableException('Integração ML não configurada.');
    const token = await this.tokenValido();
    const resposta = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(20_000),
    });
    // O corpo de erro pode conter credenciais ou dados do comprador: não propagar.
    if (!resposta.ok)
      throw new BadGatewayException(`Consulta Mercado Livre: HTTP ${resposta.status}.`);
    if (resposta.status === 204)
      throw new BadGatewayException('Consulta Mercado Livre ainda sem conteúdo.');
    return (await resposta.json()) as T;
  }

  private async tokenValido(): Promise<string> {
    if (this.renovacao) return this.renovacao;
    this.renovacao = this.carregarOuRenovar();
    try {
      return await this.renovacao;
    } catch (erro) {
      if (erro instanceof HttpException) throw erro;
      // Erros do ORM/JSON podem carregar argumentos contendo tokens; não os propagar.
      throw new ServiceUnavailableException(
        'Não foi possível carregar ou persistir a sessão Mercado Livre.',
      );
    } finally {
      this.renovacao = null;
    }
  }

  private async carregarOuRenovar(): Promise<string> {
    const sellerId = this.sellerId;
    // O lock também cobre processos distintos; refresh_token é de uso único.
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ml-oauth:${sellerId}`}))`;
        const salvo = await tx.mercadoLivreToken.findUnique({ where: { sellerId } });
        if (salvo && salvo.expiraEm.getTime() > Date.now() + 300_000) return salvo.accessToken;
        const refreshToken = salvo?.refreshToken ?? this.config.get<string>('ML_REFRESH_TOKEN');
        if (!refreshToken)
          throw new ServiceUnavailableException('Reconecte a conta do Mercado Livre.');
        const novo = await this.renovar(refreshToken);
        const valores = {
          accessToken: novo.access_token,
          refreshToken: novo.refresh_token,
          expiraEm: new Date(Date.now() + novo.expires_in * 1000),
        };
        await tx.mercadoLivreToken.upsert({
          where: { sellerId },
          create: { sellerId, ...valores },
          update: valores,
        });
        return valores.accessToken;
      },
      { maxWait: 30_000, timeout: 30_000 },
    );
  }

  private async renovar(refreshToken: string): Promise<TokenOAuth> {
    const resposta = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.get<string>('ML_APP_ID') ?? '',
        client_secret: this.config.get<string>('ML_SECRET_KEY') ?? '',
        refresh_token: refreshToken,
      }),
    });
    if (!resposta.ok)
      throw new ServiceUnavailableException(
        `OAuth Mercado Livre: HTTP ${resposta.status}; reconecte se persistir.`,
      );
    const novo = (await resposta.json()) as TokenOAuth;
    if (
      typeof novo.access_token !== 'string' ||
      !novo.access_token ||
      typeof novo.refresh_token !== 'string' ||
      !novo.refresh_token ||
      !Number.isFinite(novo.expires_in) ||
      novo.expires_in <= 0
    ) {
      throw new BadGatewayException('OAuth Mercado Livre retornou credenciais incompletas.');
    }
    return novo;
  }
}
