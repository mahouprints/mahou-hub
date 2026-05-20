// Testa se conseguimos replicar uma sessão real do Chrome em fetch nativo.
// Lê headers/cookies de scripts/shopee-affiliate/.session.local.json (gitignored).
//
// Hipóteses a confirmar:
// 1. /pdp/get_pc do produto original (mesmo itemId/shopId do cURL) → deve passar.
// 2. /pdp/get_pc de OUTRO produto da mesma loja → testa se anti-fraud é por-produto ou por-sessão.
// 3. /pdp/get_pc de produto de OUTRA loja → testa se a sessão funciona cross-shop.
// 4. /shop/search_items pelo shopId → testa rota de listagem.
// 5. /item/get → versão antiga.
//
// Se 1 passar e 2-5 falharem → x-sap-sec é assinado por payload (não dá pra reusar pra outros produtos).
// Se 1-5 passarem → sessão inteira reusable.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sessionPath = resolve(here, '../.session.local.json');
const session = JSON.parse(readFileSync(sessionPath, 'utf-8')) as {
  headers: Record<string, string>;
  cookie: string;
};

const outDir = resolve(here, '../out');
mkdirSync(outDir, { recursive: true });

async function call(label: string, url: string) {
  console.log(`\n▸ ${label}`);
  console.log(`  GET ${url}`);
  const res = await fetch(url, {
    headers: { ...session.headers, cookie: session.cookie } as Record<string, string>,
  });
  const text = await res.text();
  const sgw = res.headers.get('sgw-errmsg');
  console.log(`  HTTP ${res.status} ${res.statusText}${sgw ? ` [sgw: ${sgw}]` : ''}`);

  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }

  if (res.ok && json && (!json.error || json.error === 0)) {
    const data = json.data ?? json.item ?? json;
    const keys = Object.keys(data ?? {}).slice(0, 12);
    console.log(`  ✓ OK — chaves: ${keys.join(', ')}`);
    const safe = label.replace(/[^a-z0-9]/gi, '_');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = resolve(outDir, `authed-${safe}-${ts}.json`);
    writeFileSync(file, JSON.stringify(json, null, 2), 'utf-8');
    console.log(`    salvo em out/${safe}-${ts}.json`);
    return { ok: true, json, data };
  }

  console.log(`  ✗ body: ${text.slice(0, 220)}`);
  return { ok: false, json };
}

console.log('=== Replicar sessão Chrome em fetch nativo ===\n');
console.log(`Sessão: SPC_U=${(session.cookie.match(/SPC_U=([^;]+)/) ?? [])[1] ?? '(n/a)'}, csrftoken=${(session.cookie.match(/csrftoken=([^;]+)/) ?? [])[1]?.slice(0, 10) ?? '(n/a)'}…`);

// Top vendido da 3DTECH (mesmo do cURL — controle)
await call('A) /pdp/get_pc — produto do cURL (controle)',
  'https://shopee.com.br/api/v4/pdp/get_pc?item_id=22138319014&shop_id=789036029&tz_offset_in_minutes=-180&detail_level=0&incoming_pdp_page_source=0&incoming_pdp_page_scenario=0');

// Outro produto da mesma loja
await call('B) /pdp/get_pc — OUTRO produto da mesma loja (19778248646)',
  'https://shopee.com.br/api/v4/pdp/get_pc?item_id=19778248646&shop_id=789036029&tz_offset_in_minutes=-180&detail_level=0&incoming_pdp_page_source=0&incoming_pdp_page_scenario=0');

// Produto de loja diferente (Voolt3D top sales)
await call('C) /pdp/get_pc — produto de OUTRA loja (Voolt3D 10113558817)',
  'https://shopee.com.br/api/v4/pdp/get_pc?item_id=10113558817&shop_id=313159848&tz_offset_in_minutes=-180&detail_level=0&incoming_pdp_page_source=0&incoming_pdp_page_scenario=0');

// Rota de busca por loja (substitui paginação produto-a-produto)
await call('D) /shop/search_items — listagem por loja',
  'https://shopee.com.br/api/v4/shop/search_items?shopid=789036029&limit=30&offset=0&order=desc&by=sales&newest=0');

// API mais antiga
await call('E) /item/get (legacy)',
  'https://shopee.com.br/api/v4/item/get?itemid=22138319014&shopid=789036029');

console.log('\n=== Fim ===');
