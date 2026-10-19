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
    return this.requisicao<T>('GET', path, undefined, headers);
  }

  /** Cria um recurso sem repetição automática. Ex.: post('/items', anuncio). */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.requisicao<T>('POST', path, body);
  }

  /** Atualiza um recurso sem repetição automática. Ex.: put('/items/MLB123', alteracoes). */
  async put<T>(path: string, body: unknown): Promise<T> {
    return this.requisicao<T>('PUT', path, body);
  }

  private async requisicao<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    if (!this.estaConfigurado())
      throw new ServiceUnavailableException('Integração ML não configurada.');
    const token = await this.tokenValido();
    const resposta = await this.enviar(method, path, token, body, headers);
    // Diagnósticos de anúncios expõem apenas identificadores, nunca mensagens ou o corpo livre.
    if (!resposta.ok) {
      const contexto = contextoErroPublicacao(method, path, [
        token,
        this.config.get<string>('ML_SECRET_KEY'),
        this.config.get<string>('ML_REFRESH_TOKEN'),
      ]);
      const caminho = contexto.mercadoLivreCaminho;
      const consultaFiscal =
        caminho &&
        (/^\/items\/fiscal_information(?:\/|$)/.test(caminho) ||
          /^\/items\/MLB\d+\/fiscal_information\/detail$/.test(caminho) ||
          caminho.startsWith('/can_invoice/items/'));
      const falha =
        (method !== 'GET' && caminho?.startsWith('/items')) || consultaFiscal
          ? await this.causasSanitizadas(resposta, token)
          : undefined;
      const causas = falha?.diagnostico;
      // Apenas o validador permite HTTP 400 com avisos; criação nunca confirma sucesso assim.
      if (
        method === 'POST' &&
        path === '/items/validate' &&
        resposta.status === 400 &&
        falha?.apenasAvisos
      )
        return causas as T;
      throw new BadGatewayException({
        statusCode: 502,
        message: `${method === 'GET' ? 'Consulta' : 'Gravação'} Mercado Livre: HTTP ${resposta.status}.`,
        mercadoLivreStatus: resposta.status,
        ...contexto,
        ...(causas ? { mercadoLivreCausas: causas } : {}),
      });
    }
    if (resposta.status === 204 && method === 'GET')
      throw new BadGatewayException('Consulta Mercado Livre ainda sem conteúdo.');
    if (resposta.status === 204) return undefined as T;
    try {
      if (method === 'GET' && /^\/user-products\/MLBU\d+(?:\?|$)/.test(path))
        return JSON.parse(
          await resposta.text(),
          (chave: string, valor: unknown, contexto?: { source?: string }) => {
            if (chave !== 'family_id' || typeof valor !== 'number') return valor;
            // Node 22 fornece o literal original, antes do arredondamento de inteiros grandes.
            if (contexto?.source && /^\d+$/.test(contexto.source)) return contexto.source;
            if (Number.isSafeInteger(valor) && valor >= 0) return String(valor);
            throw new Error('Identificador de família sem precisão.');
          },
        ) as T;
      return (await resposta.json()) as T;
    } catch {
      throw new BadGatewayException('Mercado Livre retornou uma resposta JSON inválida.');
    }
  }

  private async causasSanitizadas(resposta: Response, token: string) {
    const conteudo: unknown = await resposta.json().catch(() => null);
    if (!conteudo || typeof conteudo !== 'object' || Array.isArray(conteudo)) return undefined;
    const falha = conteudo as Record<string, unknown>;
    // A decisão usa a resposta inteira, antes de limitar ou remover causas dos diagnósticos.
    const apenasAvisos =
      falha.error === 'validation_error' &&
      Array.isArray(falha.cause) &&
      falha.cause.length > 0 &&
      falha.cause.every(
        (causa: unknown) =>
          causa !== null &&
          typeof causa === 'object' &&
          !Array.isArray(causa) &&
          (causa as Record<string, unknown>).type === 'warning',
      );
    const segredos = [
      token,
      this.config.get<string>('ML_SECRET_KEY'),
      this.config.get<string>('ML_REFRESH_TOKEN'),
    ];
    const error = identificadorDiagnostico(falha.error, segredos);
    const errorCode = identificadorDiagnostico(falha.error_code, segredos);
    const cause = (Array.isArray(falha.cause) ? falha.cause : [])
      .slice(0, 20)
      .map((causa: unknown) => causaSanitizada(causa, segredos))
      .filter((causa) => Object.keys(causa).length > 0);
    return {
      apenasAvisos,
      diagnostico:
        error || errorCode || cause.length
          ? { ...(error ? { error } : {}), ...(errorCode ? { error_code: errorCode } : {}), cause }
          : undefined,
    };
  }

  private async enviar(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    token: string,
    body: unknown,
    headers: Record<string, string>,
  ) {
    try {
      // Uma falha de rede não confirma se o recurso foi criado; nunca repetir a gravação.
      return await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new BadGatewayException('Não foi possível confirmar a resposta do Mercado Livre.');
    }
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

function identificadorDiagnostico(
  valor: unknown,
  segredos: Array<string | undefined>,
  referencia = false,
) {
  const formato = referencia
    ? /^[a-zA-Z_][a-zA-Z0-9_]*(?:\[\d{1,3}\])?(?:\.[a-zA-Z_][a-zA-Z0-9_]*(?:\[\d{1,3}\])?)*$/
    : /^(?:[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*|\d{1,8})$/;
  if (typeof valor !== 'string' || valor.length > 120 || !formato.test(valor)) return undefined;
  if (segredos.some((segredo) => segredo && valor.includes(segredo))) return undefined;
  return valor;
}

/** Expõe somente rotas conhecidas de publicação, sem parâmetros. Ex.: GET /items/MLB123. */
export function contextoErroPublicacao(
  metodo: unknown,
  caminho: unknown,
  segredos: Array<string | undefined> = [],
) {
  if (!['GET', 'POST', 'PUT'].includes(String(metodo)) || typeof caminho !== 'string') return {};
  const limpo = caminho.split(/[?#]/, 1)[0]!;
  const permitido =
    /^\/items(?:\/validate|\/fiscal_information(?:\/items|\/[A-Z0-9]+(?:-[A-Z0-9]+)*)?|\/MLB\d+(?:\/description|\/fiscal_information\/detail)?)?$/.test(
      limpo,
    ) ||
    /^\/can_invoice\/items\/MLB\d+(?:\/variations\/\d+)?$/.test(limpo) ||
    /^\/user-products\/MLBU\d+$/.test(limpo) ||
    /^\/users\/\d+(?:\/items\/search)?$/.test(limpo);
  if (
    !permitido ||
    limpo.length > 160 ||
    segredos.some((segredo) => segredo && limpo.includes(segredo))
  )
    return {};
  return { mercadoLivreOperacao: String(metodo), mercadoLivreCaminho: limpo };
}

function causaSanitizada(entrada: unknown, segredos: Array<string | undefined>) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return {};
  const causa = entrada as Record<string, unknown>;
  const code = identificadorDiagnostico(causa.code, segredos);
  const type = causa.type === 'error' || causa.type === 'warning' ? causa.type : undefined;
  const references = (Array.isArray(causa.references) ? causa.references : [])
    .slice(0, 10)
    .map((valor: unknown) => identificadorDiagnostico(valor, segredos, true))
    .filter((valor): valor is string => valor !== undefined);
  return {
    ...(code ? { code } : {}),
    ...(type ? { type } : {}),
    ...(references.length ? { references } : {}),
  };
}
