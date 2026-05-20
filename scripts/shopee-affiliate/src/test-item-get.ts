// Teste exploratório da rota /api/v4/item/get (mobile-web, sem auth).
// Mesma família da /shop/get_shop_detail que já usamos pra resolver username.
// Quer confirmar: existe `historical_sold`, `cmt_count` (qtd avaliações), `liked_count`, `view_count`, `stock`, `models`?

const itemId = process.argv[2] ?? '22138319014';
const shopId = process.argv[3] ?? '789036029';

const url = `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;
console.log(`GET ${url}\n`);

const res = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://shopee.com.br/',
    'Accept': 'application/json',
  },
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText}`);
  console.error('Headers:', Object.fromEntries(res.headers.entries()));
  console.error('Body:', text.slice(0, 500));
  process.exit(1);
}

const json = JSON.parse(text);
const data = json.data ?? json;

// Lista todas as chaves top-level pra ver o que existe
console.log('Chaves top-level disponíveis:\n');
const keys = Object.keys(data ?? {}).sort();
for (const k of keys) {
  const v = (data as any)[k];
  let preview: string;
  if (v == null) preview = String(v);
  else if (Array.isArray(v)) preview = `array[${v.length}]`;
  else if (typeof v === 'object') preview = `object{${Object.keys(v).length} keys}`;
  else preview = JSON.stringify(v).slice(0, 80);
  console.log(`  · ${k}: ${preview}`);
}

console.log('\nCampos de interesse:');
const interesse = ['itemid', 'shopid', 'name', 'historical_sold', 'sold', 'global_sold_count',
  'cmt_count', 'rating_count', 'rating_star', 'liked_count', 'view_count',
  'stock', 'normal_stock', 'price', 'price_min', 'price_max', 'price_before_discount',
  'discount', 'models', 'tier_variations', 'categories', 'attributes',
  'image', 'images', 'item_status', 'ctime', 'mtime'];
for (const k of interesse) {
  if (k in (data ?? {})) {
    const v = (data as any)[k];
    let str = JSON.stringify(v);
    if (str && str.length > 200) str = str.slice(0, 200) + '…';
    console.log(`  · ${k}: ${str}`);
  } else {
    console.log(`  · ${k}: (ausente)`);
  }
}

// Salva resposta crua
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../out');
await mkdir(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const file = resolve(outDir, `item-get-${itemId}-${ts}.json`);
await writeFile(file, JSON.stringify(json, null, 2), 'utf-8');
console.log(`\nResposta completa salva em: ${file}`);
