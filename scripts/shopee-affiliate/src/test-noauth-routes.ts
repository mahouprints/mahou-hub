// Bateria de rotas Shopee testadas em 2026-05 — busca por algo que devolva
// historical_sold/cmt_count SEM precisar de x-sap-sec assinado.
//
// Estratégia: começa SEM cookies, priming via /shop/get_shop_detail (sabidamente público),
// depois bate em rotas alternativas com o jar populado.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ITEM_ID = process.argv[2] ?? '22138319014';
const SHOP_ID = process.argv[3] ?? '789036029';
const SHOP_USERNAME = process.argv[4] ?? '3dtechimprensoes';
const SHOP_SLUG = `${SHOP_USERNAME}.${SHOP_ID}`;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../out');
await mkdir(outDir, { recursive: true });

const browserHeaders = (extra: Record<string, string> = {}) => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not_A Brand";v="8"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Referer': `https://shopee.com.br/${SHOP_USERNAME}`,
  'X-Requested-With': 'XMLHttpRequest',
  'X-Api-Source': 'pc',
  'X-Shopee-Language': 'pt-BR',
  ...extra,
});

class CookieJar {
  jar = new Map<string, string>();
  absorb(setCookieValues: string[]) {
    for (const sc of setCookieValues) {
      const first = sc.split(';')[0];
      if (!first) continue;
      const eq = first.indexOf('=');
      if (eq < 0) continue;
      this.jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
    }
  }
  header(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

function getSetCookies(res: Response): string[] {
  // @ts-expect-error node-undici
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const all: string[] = [];
  res.headers.forEach((v, k) => { if (k.toLowerCase() === 'set-cookie') all.push(v); });
  return all;
}

const jar = new CookieJar();

async function tryRoute(label: string, url: string, opts: { html?: boolean; extra?: Record<string, string> } = {}) {
  const headers: Record<string, string> = opts.html
    ? {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        ...(opts.extra ?? {}),
      }
    : browserHeaders(opts.extra);
  if (jar.jar.size > 0) headers['Cookie'] = jar.header();

  console.log(`\n▸ ${label}\n  GET ${url}`);
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (e) {
    console.log(`  ✗ network: ${e instanceof Error ? e.message : e}`);
    return null;
  }

  const setCookies = getSetCookies(res);
  if (setCookies.length) jar.absorb(setCookies);
  const text = await res.text();
  const sgw = res.headers.get('sgw-errmsg');
  console.log(`  HTTP ${res.status}${sgw ? ` [sgw: ${sgw}]` : ''}${setCookies.length ? ` +${setCookies.length}c` : ''}`);

  if (!res.ok) {
    console.log(`  ✗ body: ${text.slice(0, 200)}`);
    return null;
  }

  if (opts.html) {
    // Procura blocos JSON-like inline na página: __NEXT_DATA__, __INIT_STATE__, window.__SSR_PROPS__
    const nextData = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(text);
    const ssrProps = /window\.__SSR_PROPS__\s*=\s*({[\s\S]*?});/m.exec(text);
    const initState = /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/m.exec(text);
    const jsonGlobals = ['historical_sold', 'cmt_count', 'sold_count', 'liked_count', 'historical_sold_display'].map(
      (k) => `${k}: ${text.includes(k) ? 'present' : 'absent'}`
    );
    console.log(`  HTML size: ${text.length}`);
    console.log(`  __NEXT_DATA__: ${nextData ? 'present (' + nextData[1]!.length + ' chars)' : 'absent'}`);
    console.log(`  __SSR_PROPS__: ${ssrProps ? 'present' : 'absent'}`);
    console.log(`  __INITIAL_STATE__: ${initState ? 'present' : 'absent'}`);
    console.log(`  globals: ${jsonGlobals.join(', ')}`);
    if (nextData || ssrProps || initState) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const safe = label.replace(/[^a-z0-9]/gi, '_');
      const file = resolve(outDir, `noauth-${safe}-${ts}.html`);
      await writeFile(file, text, 'utf-8');
      console.log(`  salvo: out/${safe}-${ts}.html`);
    }
    return { html: text };
  }

  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  if (!json) {
    console.log(`  ✗ não-JSON: ${text.slice(0, 200)}`);
    return null;
  }
  if (json.error && json.error !== 0) {
    console.log(`  ⚠ error=${json.error} ${json.error_msg ?? ''}`);
    return null;
  }
  console.log(`  ✓ OK — top keys: ${Object.keys(json).slice(0, 8).join(', ')}`);
  if (json.data) {
    console.log(`    data keys: ${Object.keys(json.data).slice(0, 10).join(', ')}`);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = label.replace(/[^a-z0-9]/gi, '_');
  const file = resolve(outDir, `noauth-${safe}-${ts}.json`);
  await writeFile(file, JSON.stringify(json, null, 2), 'utf-8');
  console.log(`  salvo: out/${safe}-${ts}.json`);
  return { json };
}

console.log('=== Bateria SEM auth — busca rota que ainda dá historical_sold/cmt_count ===\n');

// Passo 1: priming via /shop/get_shop_detail (sabidamente público + dá cookies anti-bot)
await tryRoute('priming: /shop/get_shop_detail',
  `https://shopee.com.br/api/v4/shop/get_shop_detail?username=${SHOP_USERNAME}`);

console.log(`\nJar após priming: ${[...jar.jar.keys()].join(', ')}\n`);

// Passo 2: HTML da página da loja (visita "real")
await tryRoute('HTML loja', `https://shopee.com.br/${SHOP_USERNAME}`, { html: true });

// Passo 3: HTML da página do produto (SSR pode trazer historical_sold inlinado)
await tryRoute('HTML produto', `https://shopee.com.br/product/${SHOP_ID}/${ITEM_ID}`, { html: true });

// Passo 4: rota /recommend/recommend — o achado do akira-kun/shopeev4api
await tryRoute('/api/v4/recommend/recommend',
  `https://shopee.com.br/api/v4/recommend/recommend?bundle=shop_page_product_tab_main&limit=10&offset=0&shopid=${SHOP_ID}&itemid=${ITEM_ID}`);

// Passo 5: rota /shop/rcmd_items
await tryRoute('/api/v4/shop/rcmd_items',
  `https://shopee.com.br/api/v4/shop/rcmd_items?shop_id=${SHOP_ID}&limit=30&offset=0&sort_type=13`);

// Passo 6: /api/v4/search/search_items por loja (filtra pela loja)
await tryRoute('/api/v4/search/search_items by shop',
  `https://shopee.com.br/api/v4/search/search_items?match_id=${SHOP_ID}&order=desc&newest=0&page_type=shop&page_size=30&scenario=PAGE_SHOP_SEARCH&version=2`);

// Passo 7: /api/v4/shop/get_products_tab_data_v2 (chartedsea cita)
await tryRoute('/api/v4/shop/get_products_tab_data_v2',
  `https://shopee.com.br/api/v4/shop/get_products_tab_data_v2?shop_id=${SHOP_ID}&limit=30&offset=0&sort_type=13`);

// Passo 8: /api/v4/pdp/get (Android version segundo chartedsea)
await tryRoute('/api/v4/pdp/get (android)',
  `https://shopee.com.br/api/v4/pdp/get?item_id=${ITEM_ID}&shop_id=${SHOP_ID}&detail_level=0`);

// Passo 9: /api/v2/item/get (versão antiga)
await tryRoute('/api/v2/item/get',
  `https://shopee.com.br/api/v2/item/get?itemid=${ITEM_ID}&shopid=${SHOP_ID}`);

// Passo 10: tentar UA mobile (algumas rotas tem regra diferente)
await tryRoute('/api/v4/recommend/recommend (UA mobile)',
  `https://shopee.com.br/api/v4/recommend/recommend?bundle=shop_page_product_tab_main&limit=10&offset=0&shopid=${SHOP_ID}&itemid=${ITEM_ID}`,
  { extra: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' } });

// Passo 11: rotas m.shopee.com.br (mobile-web tem outro perfil de proteção?)
await tryRoute('m.shopee.com.br /api/v4/item/get',
  `https://m.shopee.com.br/api/v4/item/get?itemid=${ITEM_ID}&shopid=${SHOP_ID}`,
  { extra: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } });

console.log('\n=== Sumário do jar final ===');
console.log(`${jar.jar.size} cookies: ${[...jar.jar.keys()].join(', ')}`);
