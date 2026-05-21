// Cliente HTTP fininho pro Mahou Hub API. Lê URL + token JWT do env.
// Token é gerado uma vez via POST /api/v1/auth/api-token e colado em .env.local.

const apiUrl = process.env.MAHOU_API_URL?.replace(/\/+$/, '') ?? 'https://api.mahouprints.com';
const apiToken = process.env.MAHOU_API_TOKEN;

if (!apiToken) {
  throw new Error(
    'MAHOU_API_TOKEN não setado. Gere via POST /api/v1/auth/api-token (autenticado) ' +
      'e coloque em .env.local ou no env do MCP no claude_desktop_config.json.',
  );
}

export async function apiCall<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${apiUrl}/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiToken}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mahou API ${method} ${path} → ${res.status}: ${text}`);
  }
  // 204 No Content (delete)
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
