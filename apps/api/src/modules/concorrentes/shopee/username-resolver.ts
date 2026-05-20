import { Logger } from '@nestjs/common';

/**
 * Resolve username (slug shopee.com.br/<x>) ou shopId numérico (shopee.com.br/shop/<id>)
 * pra { shopId, detail } via mobile-web pública. Sem auth, mas precisa headers desktop
 * pra não cair no anti-bot básico.
 *
 * Mantém retry exponencial (3 tentativas) e timeout 10s.
 */
export type ShopDetailMobileWeb = {
  shopid: number;
  name: string;
  account?: { username?: string };
  follower_count?: number;
  rating_star?: number;
  item_count?: number;
  response_rate?: number;
  response_time?: number;
  is_official_shop?: boolean;
  is_preferred_plus_seller?: boolean;
  cover?: string;
  description?: string;
  ctime?: number;
  last_active_time?: number;
};

const log = new Logger('ShopeeUsernameResolver');

const HEADERS_DESKTOP: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': 'https://shopee.com.br/',
};

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

export function parseShopeeUrl(input: string): { kind: 'shopId'; shopId: number } | { kind: 'username'; username: string } {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return { kind: 'shopId', shopId: Number(trimmed) };
  const cleaned = trimmed.replace(/^https?:\/\/(www\.)?shopee\.com\.br\/?/i, '').replace(/^\/+/, '');
  // shopee.com.br/shop/<id>
  const shopMatch = cleaned.match(/^shop\/(\d+)/);
  if (shopMatch) return { kind: 'shopId', shopId: Number(shopMatch[1]) };
  const username = cleaned.split(/[/?#]/)[0]!;
  if (!username) throw new Error(`URL Shopee inválida: ${input}`);
  return { kind: 'username', username };
}

export async function resolveShop(input: string): Promise<{ shopId: number; detail: ShopDetailMobileWeb }> {
  const parsed = parseShopeeUrl(input);
  if (parsed.kind === 'shopId') {
    const detail = await fetchShopDetailById(parsed.shopId);
    return { shopId: parsed.shopId, detail };
  }
  const detail = await fetchShopDetailByUsername(parsed.username);
  return { shopId: detail.shopid, detail };
}

async function fetchShopDetailByUsername(username: string): Promise<ShopDetailMobileWeb> {
  const url = `https://shopee.com.br/api/v4/shop/get_shop_detail?username=${encodeURIComponent(username)}`;
  return fetchWithRetry(url, `username=${username}`);
}

async function fetchShopDetailById(shopId: number): Promise<ShopDetailMobileWeb> {
  const url = `https://shopee.com.br/api/v4/shop/get_shop_detail?shopid=${shopId}`;
  return fetchWithRetry(url, `shopId=${shopId}`);
}

async function fetchWithRetry(url: string, label: string): Promise<ShopDetailMobileWeb> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchOnce(url);
    } catch (err) {
      lastErr = err;
      const retryable = isRetryable(err);
      if (!retryable || attempt === MAX_RETRIES) break;
      const waitMs = 1000 * 2 ** attempt;
      log.warn(`Resolver ${label} falhou (tentativa ${attempt + 1}), retry em ${waitMs}ms: ${err instanceof Error ? err.message : err}`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Resolver ${label} falhou`);
}

async function fetchOnce(url: string): Promise<ShopDetailMobileWeb> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS_DESKTOP, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`mobile-web HTTP ${res.status}: ${text.slice(0, 200)}`);
    const json = JSON.parse(text) as { error?: number; data?: ShopDetailMobileWeb };
    if (json.error && json.error !== 0) throw new Error(`mobile-web error=${json.error}: ${text.slice(0, 200)}`);
    if (!json.data?.shopid) throw new Error(`Resposta sem shopid: ${text.slice(0, 200)}`);
    return json.data;
  } finally {
    clearTimeout(tid);
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true;
    if (err.message.includes('HTTP 5')) return true;
    if (err.message.includes('ECONN') || err.message.includes('fetch failed')) return true;
  }
  return false;
}
