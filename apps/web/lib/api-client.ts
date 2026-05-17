/**
 * Cliente HTTP do backend. Todas as chamadas vão para `/api/*`, que o Next
 * roteia via rewrite para `NEXT_PUBLIC_API_URL` (proxy server-side para evitar
 * mixed-cookies entre `hub.mahouprints.com` e `api.mahouprints.com`).
 *
 * Em 401 redireciona para /login automaticamente (sessão expirada/inexistente).
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(`/api${path}`, {
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
  return texto || `Erro ${res.status}`;
}
