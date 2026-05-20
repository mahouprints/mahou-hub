// Bateria de testes pra contornar o 403 do /api/v4/item/get da Shopee.
// Estratégia: cookies pré-carregadas + headers completos de browser + várias rotas alternativas.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ITEM_ID = process.argv[2] ?? '22138319014';
const SHOP_ID = process.argv[3] ?? '789036029';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../out');
await mkdir(outDir, { recursive: true });

// Headers completos como Chrome desktop.
const browserHeaders = (extra: Record<string, string> = {}) => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not_A Brand";v="8"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Referer': 'https://shopee.com.br/',
  'X-Requested-With': 'XMLHttpRequest',
  ...extra,
});

// CookieJar simples: parseia Set-Cookie de respostas anteriores.
class CookieJar {
  jar = new Map<string, string>();
  absorb(setCookieValues: string[]) {
    for (const sc of setCookieValues) {
      const first = sc.split(';')[0];
      if (!first) continue;
      const [name, ...rest] = first.split('=');
      if (!name) continue;
      this.jar.set(name.trim(), rest.join('=').trim());
    }
  }
  header(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

const jar = new CookieJar();

// Node fetch retorna headers como Headers obj; vamos extrair Set-Cookie (pode ter múltiplas).
function getSetCookies(res: Response): string[] {
  const all: string[] = [];
  // @ts-expect-error node-undici expõe getSetCookie
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  res.headers.forEach((v, k) => { if (k.toLowerCase() === 'set-cookie') all.push(v); });
  return all;
}

async function tryUrl(label: string, url: string, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = browserHeaders(extraHeaders);
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
  const sgwErrmsg = res.headers.get('sgw-errmsg');
  const retryAfter = res.headers.get('retry-after');
  console.log(`  HTTP ${res.status} ${res.statusText}${sgwErrmsg ? ` (${sgwErrmsg})` : ''}${retryAfter ? ` retry-after=${retryAfter}` : ''}`);
  if (setCookies.length) console.log(`  +${setCookies.length} cookie(s): ${setCookies.map((c) => c.split('=')[0]).join(', ')}`);

  if (res.ok) {
    let json: any;
    try { json = JSON.parse(text); } catch { json = null; }
    const error = json?.error;
    if (error && error !== 0) {
      console.log(`  ⚠ JSON error=${error} (${json?.error_msg ?? 'sem msg'})`);
    } else {
      const summary = json ? Object.keys(json.data ?? json).slice(0, 10).join(', ') : '(não-JSON)';
      console.log(`  ✓ OK — chaves: ${summary}`);
      // Quando OK, salvar pra inspeção
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const safe = label.replace(/[^a-z0-9]/gi, '_');
      const file = resolve(outDir, `bypass-${safe}-${ts}.json`);
      await writeFile(file, JSON.stringify(json, null, 2), 'utf-8');
      console.log(`    salvo em ${file}`);
      return json;
    }
  } else {
    console.log(`  ✗ body: ${text.slice(0, 200)}`);
  }
  return null;
}

console.log('=== Bypass test: cookies + headers + rotas alternativas ===');

// PASSO 1: priming — hit numa rota leve (a loja) pra colher cookies anti-bot.
console.log('\n=== Passo 1: priming cookie jar via /shop/get_shop_detail ===');
await tryUrl('priming /shop/get_shop_detail',
  `https://shopee.com.br/api/v4/shop/get_shop_detail?username=3dtechimprensoes`);

// PASSO 1.5: GET na própria página da loja (HTML) pra colher mais cookies.
console.log('\n=== Passo 1.5: priming via HTML da loja ===');
try {
  const res = await fetch('https://shopee.com.br/3dtechimprensoes', {
    headers: { ...browserHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8' }), 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', Cookie: jar.header() },
  });
  const sc = getSetCookies(res);
  if (sc.length) jar.absorb(sc);
  console.log(`  HTTP ${res.status}, +${sc.length} cookie(s); jar agora tem ${jar.jar.size}: ${[...jar.jar.keys()].join(', ')}`);
} catch (e) { console.log(`  ✗ ${e instanceof Error ? e.message : e}`); }

console.log(`\nCookies coletados: ${[...jar.jar.keys()].join(', ') || '(nenhum)'}\n`);
console.log('=== Passo 2: tentar /item/get e variantes ===');

// PASSO 2: bater nas rotas com cookies + headers completos
await tryUrl('/api/v4/item/get',
  `https://shopee.com.br/api/v4/item/get?itemid=${ITEM_ID}&shopid=${SHOP_ID}`);

await tryUrl('/api/v2/item/get',
  `https://shopee.com.br/api/v2/item/get?itemid=${ITEM_ID}&shopid=${SHOP_ID}`);

await tryUrl('/api/v4/pdp/get_pc',
  `https://shopee.com.br/api/v4/pdp/get_pc?item_id=${ITEM_ID}&shop_id=${SHOP_ID}&detail_level=0`);

await tryUrl('/api/v4/item/get_ratings',
  `https://shopee.com.br/api/v4/item/get_ratings?itemid=${ITEM_ID}&shopid=${SHOP_ID}&type=0&limit=1&offset=0`);

console.log('\n=== Passo 3: busca por loja (search_items) — substitui /item/get inteiro se funcionar ===');

await tryUrl('/api/v4/search/search_items by shop',
  `https://shopee.com.br/api/v4/search/search_items?match_id=${SHOP_ID}&order=desc&newest=0&page_type=shop&page_size=60&scenario=PAGE_SHOP_SEARCH&version=2&view_session_id=0`);

await tryUrl('/api/v4/shop/search_items (rota antiga)',
  `https://shopee.com.br/api/v4/shop/search_items?shopid=${SHOP_ID}&limit=30&offset=0&order=desc&by=sales&newest=0`);

console.log('\n=== Sumário do jar final ===');
console.log(`${jar.jar.size} cookies: ${[...jar.jar.keys()].join(', ') || '(nenhum)'}`);
