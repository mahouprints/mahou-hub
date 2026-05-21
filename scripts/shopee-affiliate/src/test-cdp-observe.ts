// CDP em modo OBSERVADOR: não navega nada, apenas escuta o tráfego
// das páginas que o usuário já abriu / vai abrir manualmente.
//
// Por que? page.goto() do Playwright dispara hints de automation que a
// Shopee detecta. Se você navegar manualmente, o anti-bot vê uma sessão
// humana normal e a chamada /pdp/get_pc passa.
//
// Pré-requisitos:
// 1. Fechar TODAS as instâncias do Chrome (incluindo as em segundo plano)
// 2. Reabrir Chrome com:
//      chrome.exe --remote-debugging-port=9222 --disable-blink-features=AutomationControlled
//    (sem --user-data-dir → usa seu perfil normal já logado na Shopee)
// 3. Rodar este script
// 4. Navegar você mesmo até https://shopee.com.br/product/789036029/22138319014
//
// O script captura a primeira /pdp/get_pc OK e mostra os campos.

import { chromium, type BrowserContext, type Page } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://localhost:9222';
const WAIT_TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS ?? 10 * 60 * 1000); // 10min

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../out');
await mkdir(outDir, { recursive: true });

const GRN = '\x1b[32m';
const YEL = '\x1b[33m';
const CYN = '\x1b[36m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RST = '\x1b[0m';

type Hit = { url: string; status: number; body: string; ts: number };
const hits: Hit[] = [];

function isOkResponse(status: number, body: string): boolean {
  if (status !== 200) return false;
  try {
    const j = JSON.parse(body);
    if (j?.error && j.error !== 0) return false;
    return !!j?.data?.product_review;
  } catch { return false; }
}

function attachToPage(page: Page, label: string) {
  console.log(`${DIM}  anexando listener em: ${label} (${page.url()})${RST}`);
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/api/v4/pdp/get_pc')) return;
    try {
      const body = await res.text();
      const hit: Hit = { url, status: res.status(), body, ts: Date.now() };
      hits.push(hit);
      const ok = isOkResponse(hit.status, body);
      const marker = ok ? GRN + '✓ OK' : RED + '✗ BLOQUEADO';
      console.log(`${marker}${RST} /pdp/get_pc → HTTP ${res.status()} (${body.length}b)`);
      if (!ok && body.length < 400) console.log(`    body: ${body}`);
    } catch (e) {
      console.log(`  ⚠ erro lendo body: ${e instanceof Error ? e.message : e}`);
    }
  });
}

function attachToContext(ctx: BrowserContext, label: string) {
  for (const p of ctx.pages()) attachToPage(p, `${label}/existing`);
  ctx.on('page', (p) => {
    p.once('load', () => attachToPage(p, `${label}/new`));
    attachToPage(p, `${label}/new`);
  });
}

console.log(`${CYN}=== CDP OBSERVE ===${RST}`);
console.log(`Conectando em ${CDP_ENDPOINT}…`);
const t0 = Date.now();
const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
console.log(`✓ conectado em ${Date.now() - t0}ms`);
console.log(`  contextos: ${browser.contexts().length}`);

browser.contexts().forEach((ctx, i) => attachToContext(ctx, `ctx${i}`));
browser.on('disconnected', () => console.log(`${YEL}⚠ browser desconectou${RST}`));

console.log(`\n${YEL}➤ AGORA navegue você mesmo no Chrome até um produto da Shopee.${RST}`);
console.log(`${YEL}  Sugestão: entrar pela home (shopee.com.br), clicar num produto naturalmente.${RST}`);
console.log(`${YEL}  Produto-controle: https://shopee.com.br/product/789036029/22138319014${RST}`);
console.log(`${DIM}\n  (esperando ${WAIT_TIMEOUT_MS / 1000}s pela primeira /pdp/get_pc OK…)${RST}\n`);

// Polling até pegar um OK ou timeout
const start = Date.now();
while (Date.now() - start < WAIT_TIMEOUT_MS) {
  const ok = hits.find((h) => isOkResponse(h.status, h.body));
  if (ok) {
    const json = JSON.parse(ok.body);
    const r = json.data.product_review;
    const it = json.data.item ?? {};
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = resolve(outDir, `cdp-observe-${ts}.json`);
    await writeFile(file, ok.body, 'utf-8');
    console.log(`\n${GRN}════════════════════════════════════════════════════════════${RST}`);
    console.log(`${GRN}✓ CAPTUROU /pdp/get_pc OK${RST}`);
    console.log(`${GRN}════════════════════════════════════════════════════════════${RST}`);
    console.log(`  salvo: out/cdp-observe-${ts}.json`);
    console.log(`\n  itemid: ${it.itemid}`);
    console.log(`  shopid: ${it.shopid}`);
    console.log(`  title: ${it.title ?? it.name ?? '(?)'}`);
    console.log(`  historical_sold: ${r.historical_sold}`);
    console.log(`  historical_sold_display: ${r.historical_sold_display}`);
    console.log(`  global_sold: ${r.global_sold}`);
    console.log(`  global_sold_display: ${r.global_sold_display}`);
    console.log(`  cmt_count: ${r.cmt_count}`);
    console.log(`  total_rating_count: ${r.total_rating_count}`);
    console.log(`  liked_count: ${r.liked_count}`);
    console.log(`  rating_star: ${r.rating_star}`);
    console.log(`  rating_count: ${JSON.stringify(r.rating_count)}`);
    console.log(`\n  latência da request observada: viu em ${ok.ts - t0}ms desde conexão`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1000));
}

console.log(`\n${RED}✗ timeout sem capturar /pdp/get_pc OK${RST}`);
console.log(`  ${hits.length} response(s) total:`);
for (const h of hits) console.log(`    ${h.status} (${h.body.length}b) ${h.url.slice(0, 100)}`);
process.exit(1);
