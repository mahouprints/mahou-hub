/**
 * Cliente HTTP do backend. Todas as chamadas vão para `/api/*`, que o Next
 * roteia via rewrite para `NEXT_PUBLIC_API_URL` (proxy server-side para evitar
 * mixed-cookies entre `hub.mahouprints.com` e `api.mahouprints.com`).
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
  if (!res.ok) {
    const corpo = await res.text();
    throw new Error(`HTTP ${res.status}: ${corpo}`);
  }
  return res.json() as Promise<T>;
}
