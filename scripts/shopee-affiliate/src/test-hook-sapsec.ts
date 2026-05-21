// Hook em window.fetch ANTES da navegação pra capturar todos os pares
// (URL, x-sap-sec, x-sap-ri, x-sap-access-*) gerados pelo JS da Shopee.
//
// Objetivo: descobrir se o token é determinístico por URL (replicável fora do browser)
// ou se depende de estado interno do JS (timing, salt, session, fingerprint).

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://localhost:9222';
const TARGET_ITEMS = [
  { shopId: '789036029', itemId: '22138319014' },
  { shopId: '789036029', itemId: '22138319014' }, // mesmo produto 2x — testa determinismo
  { shopId: '789036029', itemId: '19778248646' },
];

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../out');
await mkdir(outDir, { recursive: true });

const t0 = Date.now();
const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
const ctx = browser.contexts()[0]!;
console.log('=== hook x-sap-sec via CDP ===');

// Script injetado em CADA página ANTES de qualquer script do site rodar.
// Override em fetch + XMLHttpRequest pra capturar todos os headers SAP.
const initScript = `
(() => {
  if (window.__sapHookInstalled) return;
  window.__sapHookInstalled = true;
  window.__sapHits = [];

  const SAP_KEYS = ['x-sap-sec', 'x-sap-ri', 'x-sap-access-f', 'x-sap-access-s', 'x-sap-access-t', 'af-ac-enc-dat', 'af-ac-enc-sz-token'];

  // fetch override
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const headers = {};
      const h = (init && init.headers) || (input && input.headers);
      if (h) {
        if (typeof h.forEach === 'function') h.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        else if (Array.isArray(h)) h.forEach(([k, v]) => { headers[k.toLowerCase()] = v; });
        else for (const k of Object.keys(h)) headers[k.toLowerCase()] = h[k];
      }
      const sap = {};
      let hasSap = false;
      for (const key of SAP_KEYS) {
        if (headers[key] != null) { sap[key] = String(headers[key]); hasSap = true; }
      }
      if (hasSap && url.includes('/api/')) {
        window.__sapHits.push({ via: 'fetch', url, sap, ts: Date.now() });
      }
    } catch (e) { /* */ }
    return origFetch.apply(this, arguments);
  };

  // XHR override (setRequestHeader)
  const origSetReq = XMLHttpRequest.prototype.setRequestHeader;
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__sapUrl = url;
    this.__sapSet = {};
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    const lk = k.toLowerCase();
    if (SAP_KEYS.indexOf(lk) >= 0) {
      this.__sapSet = this.__sapSet || {};
      this.__sapSet[lk] = String(v);
      // só registra quando há algum SAP key
      if (this.__sapUrl && this.__sapUrl.includes('/api/')) {
        window.__sapHits.push({ via: 'xhr', url: this.__sapUrl, sap: { ...this.__sapSet }, ts: Date.now() });
      }
    }
    return origSetReq.apply(this, arguments);
  };
})();
`;

await ctx.addInitScript(initScript);
console.log('✓ initScript instalado em ctx');

type Hit = { via: 'fetch' | 'xhr'; url: string; sap: Record<string, string>; ts: number };
const allHits: Hit[] = [];

for (const t of TARGET_ITEMS) {
  console.log(`\n▸ navegando ${t.itemId}`);
  const page = await ctx.newPage();
  const url = `https://shopee.com.br/product/${t.shopId}/${t.itemId}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(4000);
  } catch (e) {
    console.log(`  goto: ${e instanceof Error ? e.message : e}`);
  }

  // extrai hits da janela
  const hits = await page.evaluate<Hit[]>('window.__sapHits || []');
  console.log(`  capturou ${hits.length} hit(s) com SAP headers`);

  // Filtra só pdp/get_pc + item/get + recommend
  const interesting = hits.filter((h) =>
    /\/api\/v4\/(pdp\/get_pc|item\/get|recommend\/recommend|shop\/rcmd_items|search\/search_items)/.test(h.url),
  );
  console.log(`  ${interesting.length} request(s) interessante(s):`);
  for (const h of interesting) {
    const sapSec = h.sap['x-sap-sec'];
    const sapRi = h.sap['x-sap-ri'];
    console.log(`    ${h.via} ${h.url.slice(0, 80)}…`);
    console.log(`      x-sap-sec[0..40]: ${sapSec ? sapSec.slice(0, 40) + '…' : '(ausente)'}`);
    console.log(`      x-sap-ri:         ${sapRi ? sapRi.slice(0, 60) : '(ausente)'}`);
    console.log(`      keys: ${Object.keys(h.sap).join(', ')}`);
  }

  allHits.push(...interesting);
  await page.close();
  await new Promise((r) => setTimeout(r, 1500));
}

// === Análise: token determinístico por URL? ===
console.log('\n=== análise determinismo ===');
const byUrl = new Map<string, string[]>();
for (const h of allHits) {
  const path = h.url.split('?')[0] + '?' + (h.url.split('?')[1] ?? '').split('&').sort().join('&');
  const sec = h.sap['x-sap-sec'] ?? '';
  if (!byUrl.has(path)) byUrl.set(path, []);
  byUrl.get(path)!.push(sec);
}
for (const [path, secs] of byUrl) {
  const uniq = new Set(secs);
  console.log(`  ${path.slice(0, 80)}`);
  console.log(`    ${secs.length} chamada(s), ${uniq.size} token(s) único(s) ${uniq.size === 1 ? '→ DETERMINÍSTICO' : '→ stateful (timestamp/salt/etc)'}`);
}

// === análise tamanho/formato ===
console.log('\n=== formato x-sap-sec ===');
const samples = allHits.map((h) => h.sap['x-sap-sec']).filter(Boolean) as string[];
if (samples.length) {
  const lens = samples.map((s) => s.length);
  console.log(`  ${samples.length} samples | tamanhos: min=${Math.min(...lens)}, max=${Math.max(...lens)}`);
  console.log(`  primeiro: ${samples[0]!.slice(0, 100)}…`);
  // hex? base64? json?
  const isHex = /^[0-9a-f]+$/i.test(samples[0]!);
  const isB64 = /^[A-Za-z0-9+/=_-]+$/.test(samples[0]!);
  console.log(`  pattern: hex=${isHex}, base64-ish=${isB64}, len mediano=${lens.sort()[Math.floor(lens.length / 2)]}`);
}

const ts = new Date().toISOString().replace(/[:.]/g, '-');
await writeFile(resolve(outDir, `hook-sapsec-${ts}.json`), JSON.stringify(allHits, null, 2), 'utf-8');
console.log(`\nsalvo: out/hook-sapsec-${ts}.json`);
console.log(`tempo total: ${Date.now() - t0}ms`);

process.exit(0);
