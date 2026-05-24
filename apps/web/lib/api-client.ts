/**
 * Cliente HTTP do backend.
 *
 * Em prod o frontend chama `api.mahouprints.com` direto (`NEXT_PUBLIC_API_BASE_URL`
 * setado na Vercel) — sai do caminho o proxy `/api/*` que tava dando
 * `ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR` intermitente em uploads multipart.
 * O cookie `mahou_token` é compartilhado em `.mahouprints.com` (`SameSite=None`)
 * pra que o navegador inclua nas chamadas cross-origin.
 *
 * Em dev, `NEXT_PUBLIC_API_BASE_URL` fica vazio e o `/api/*` cai no rewrite do
 * next.config.ts (cookie continua mesma origem).
 *
 * Em 401 redireciona para /login automaticamente (sessão expirada/inexistente).
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL
  ? `${process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/api/v1`
  : '/api';

/** Resolve URL absoluta pra um path tipo `/produtos/abc/imagens`. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(apiUrl(path), {
    ...rest,
    credentials: 'include',
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    const atual = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(atual)}`;
    throw new Error('Sessão expirada');
  }

  if (!res.ok) {
    throw new ApiError(res.status, await extrairMensagem(res));
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch com retry pra erros transitórios — usado em uploads multipart que
 * sofriam de `ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR` (CD8) da Vercel ou drops
 * de conexão TCP. Mesmo agora que chamamos a API direto, mantemos pra cobrir
 * blips de rede do cliente sem expor erro pro usuário.
 *
 * Retry em erro de rede (fetch throw) e 5xx. NÃO retenta 4xx (validação,
 * auth, payload grande demais — esses não vão resolver sozinhos).
 */
export async function fetchComRetry(
  url: string,
  init: RequestInit,
  tentativas = 3,
): Promise<Response> {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, i * 1500));
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && res.status < 600) {
        ultimoErro = new Error(`HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error('Falha de rede após múltiplas tentativas');
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Extrai mensagem legível da resposta de erro. NestJS retorna
 * `{ message, error, statusCode }` ou `{ message: string[], ... }` em
 * validation errors. Cai pro texto cru se não for JSON.
 *
 * Páginas de erro da Vercel (proxy) vêm como HTML/texto com códigos tipo
 * `ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR` — traduzimos pra mensagem clara.
 */
async function extrairMensagem(res: Response): Promise<string> {
  const texto = await res.text();
  try {
    const corpo = JSON.parse(texto) as { message?: string | string[] };
    if (Array.isArray(corpo.message)) return corpo.message.join(' · ');
    if (typeof corpo.message === 'string') return corpo.message;
  } catch {
    // não é JSON, devolve o texto cru
  }
  if (
    texto.includes('ROUTER_EXTERNAL_TARGET') ||
    texto.includes('An error occurred with this application')
  ) {
    return 'Falha de conexão com a API. Tente novamente em instantes.';
  }
  return texto || `Erro ${res.status}`;
}
