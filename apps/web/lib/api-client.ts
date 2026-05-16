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
    const corpo = await res.text();
    throw new Error(`HTTP ${res.status}: ${corpo}`);
  }
  return res.json() as Promise<T>;
}
