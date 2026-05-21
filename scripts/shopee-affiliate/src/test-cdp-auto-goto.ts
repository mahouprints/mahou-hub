// Testa se page.goto() via CDP passa DEPOIS que o usuário navegou manualmente
// e "esquentou" o perfil dedicado. Se passar, automação semanal é viável.
//
// Estratégia: conecta CDP, abre NOVA aba na MESMA context (compartilha cookies/profile),
// faz page.goto direto num produto-alvo, captura /pdp/get_pc passivamente, mede tempo.

import { chromium, type Page } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGETS = [
  // 3DTECH top vendido (controle original)
  { shopId: '789036029', itemId: '22138319014', label: '3DTECH 22138319014' },
  // 3DTECH outro produto
  { shopId: '789036029', itemId: '19778248646', label: '3DTECH 19778248646' },
];

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://localhost:9222';
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../out');
await mkdir(outDir, { recursive: true });

type Hit = { url: string; status: number; body: string; ts: number };

function isOk(hit: Hit): boolean {
  if (hit.status !== 200) return false;
  try { const j = JSON.parse(hit.body); return !!(j?.data?.product_review && !j.error); }
  catch { return false; }
}

function isBlocked(hit: Hit): boolean {
  if (hit.status >= 400) return true;
  try { const j = JSON.parse(hit.body); return !!(j?.error && j.error !== 0); }
  catch { return false; }
}

console.log(`=== CDP auto-goto test ===`);
const t0 = Date.now();
const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
const ctx = browser.contexts()[0]!;
console.log(`✓ conectado, ctx tem ${ctx.pages().length} página(s)`);

const results: Array<{ label: string; ok: boolean; ms: number; capturedHit?: Hit; finalUrl?: string }> = [];

for (const t of TARGETS) {
  console.log(`\n▸ ${t.label}`);
  const page = await ctx.newPage();
  const hits: Hit[] = [];
  page.on('response', async (res) => {
    if (!res.url().includes('/api/v4/pdp/get_pc')) return;
    try {
      const body = await res.text();
      hits.push({ url: res.url(), status: res.status(), body, ts: Date.now() });
    } catch { /* */ }
  });

  const url = `https://shopee.com.br/product/${t.shopId}/${t.itemId}`;
  const tStart = Date.now();
  let finalUrl = '';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    finalUrl = page.url();
    // pequena espera pra request /pdp/get_pc disparar
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log(`  ⚠ goto: ${e instanceof Error ? e.message : e}`);
    finalUrl = page.url();
  }

  const ms = Date.now() - tStart;
  const okHit = hits.find(isOk);
  const blockedHit = hits.find(isBlocked);
  const captcha = /\/verify\/captcha|\/anti_fraud|\/verify\/traffic/.test(finalUrl);

  if (okHit) {
    console.log(`  ${'\x1b[32m'}✓ OK em ${ms}ms${'\x1b[0m'}`);
    const j = JSON.parse(okHit.body);
    const r = j.data.product_review;
    console.log(`    sold_display: ${r.historical_sold_display}, cmt_count: ${r.cmt_count}, rating_count: ${r.total_rating_count}, liked: ${r.liked_count}`);
    results.push({ label: t.label, ok: true, ms, capturedHit: okHit, finalUrl });
  } else if (blockedHit) {
    console.log(`  ${'\x1b[31m'}✗ BLOQUEADO (HTTP ${blockedHit.status}) em ${ms}ms${'\x1b[0m'}`);
    console.log(`    body: ${blockedHit.body.slice(0, 200)}`);
    console.log(`    finalUrl: ${finalUrl.slice(0, 120)}`);
    results.push({ label: t.label, ok: false, ms, finalUrl });
  } else if (captcha) {
    console.log(`  ${'\x1b[33m'}⚠ CAPTCHA (sem /pdp/get_pc) em ${ms}ms${'\x1b[0m'}`);
    console.log(`    finalUrl: ${finalUrl.slice(0, 120)}`);
    results.push({ label: t.label, ok: false, ms, finalUrl });
  } else {
    console.log(`  ${'\x1b[33m'}? sem hit /pdp/get_pc em ${ms}ms — finalUrl: ${finalUrl.slice(0, 120)}${'\x1b[0m'}`);
    results.push({ label: t.label, ok: false, ms, finalUrl });
  }

  await page.close();
  // pausa pra simular intervalo entre requests
  await new Promise((r) => setTimeout(r, 2000));
}

console.log(`\n=== sumário ===`);
const oks = results.filter((r) => r.ok).length;
const avg = Math.round(results.reduce((a, b) => a + b.ms, 0) / results.length);
console.log(`  ${oks}/${results.length} OK | latência média: ${avg}ms`);
console.log(`  tempo total do teste: ${Date.now() - t0}ms`);

// Salva sumário pra plano comparativo
const ts = new Date().toISOString().replace(/[:.]/g, '-');
await writeFile(
  resolve(outDir, `auto-goto-summary-${ts}.json`),
  JSON.stringify(
    {
      ts,
      results: results.map(({ capturedHit, ...rest }) => ({
        ...rest,
        capturedSize: capturedHit?.body.length,
      })),
    },
    null,
    2,
  ),
  'utf-8',
);

process.exit(oks === results.length ? 0 : 1);
