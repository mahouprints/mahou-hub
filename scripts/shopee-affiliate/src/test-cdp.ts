// Conecta no Chrome real do usuário via CDP (--remote-debugging-port=9222)
// e tenta capturar a response do /api/v4/pdp/get_pc.
//
// Captcha-aware: detecta resposta 403/error=90309999 ou redirect pra /verify/traffic,
// alerta o usuário no terminal e ESPERA ele resolver manualmente no Chrome.
//
// Pré-requisito: Chrome aberto em --remote-debugging-port=9222 com sessão logada.

import { chromium, type Page } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ITEM_ID = process.argv[2] ?? '22138319014';
const SHOP_ID = process.argv[3] ?? '789036029';
const PRODUCT_URL = `https://shopee.com.br/product/${SHOP_ID}/${ITEM_ID}`;
const CDP_ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://localhost:9222';
const CAPTCHA_TIMEOUT_MS = 5 * 60 * 1000; // 5min pra resolver

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../out');
await mkdir(outDir, { recursive: true });

const BEL = '';
const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const GRN = '\x1b[32m';
const CYN = '\x1b[36m';
const RST = '\x1b[0m';

function log(msg: string) { console.log(msg); }
function alertCaptcha(msg: string) {
  // Bell + cor + linhas separadoras pra chamar atenção
  process.stdout.write(BEL + BEL + BEL);
  console.log('\n' + RED + '═'.repeat(70) + RST);
  console.log(RED + '🚨 CAPTCHA / VERIFICAÇÃO DETECTADA 🚨' + RST);
  console.log(RED + msg + RST);
  console.log(YEL + '➤ Resolva manualmente na janela do Chrome. Vou esperar.' + RST);
  console.log(RED + '═'.repeat(70) + RST + '\n');
}

type PdpHit = { url: string; status: number; body: string; ts: number };

const captured: PdpHit[] = [];
let captchaSeen = false;

function isCaptchaUrl(url: string): boolean {
  return /\/verify\/traffic|\/captcha|\/anti-?bot/i.test(url);
}

function isBlocked(status: number, body: string): boolean {
  if (status === 403) return true;
  if (!body) return false;
  try {
    const j = JSON.parse(body);
    if (j && j.error && j.error !== 0) return true;
  } catch { /* */ }
  return false;
}

log(`=== CDP test (captcha-aware) ===`);
log(`Conectando em ${CDP_ENDPOINT}…`);
const t0 = Date.now();
const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
log(`✓ conectado em ${Date.now() - t0}ms — contextos: ${browser.contexts().length}`);

const ctx = browser.contexts()[0] ?? (await browser.newContext());
log(`  páginas no ctx: ${ctx.pages().length}`);

// Reusa página existente (pra herdar histórico/cookies) ou cria nova.
const existing = ctx.pages().find((p) => p.url().includes('shopee.com.br'));
const page: Page = existing ?? (await ctx.newPage());
log(`  usando ${existing ? 'página existente' : 'nova página'}: ${page.url()}`);

page.on('response', async (res) => {
  const url = res.url();
  if (isCaptchaUrl(url)) {
    captchaSeen = true;
    log(`  ⚠ navegação pra ${url}`);
    return;
  }
  if (!url.includes('/api/v4/pdp/get_pc')) return;
  try {
    const body = await res.text();
    const hit: PdpHit = { url, status: res.status(), body, ts: Date.now() };
    captured.push(hit);
    const blocked = isBlocked(hit.status, body);
    log(`  ▸ /pdp/get_pc → HTTP ${hit.status} (${body.length} bytes)${blocked ? ' [BLOQUEADO]' : ' [OK]'}`);
    if (blocked) captchaSeen = true;
  } catch (e) {
    log(`  ⚠ erro lendo body: ${e instanceof Error ? e.message : e}`);
  }
});

page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame() && isCaptchaUrl(frame.url())) {
    captchaSeen = true;
  }
});

log(`\nNavegando pra ${PRODUCT_URL}…`);
const tNav = Date.now();
try {
  await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  log(`✓ DOMContentLoaded em ${Date.now() - tNav}ms (URL atual: ${page.url()})`);
} catch (e) {
  log(`⚠ goto: ${e instanceof Error ? e.message : e}`);
}

// Espera inicial pra dar chance da request /pdp/get_pc disparar
await page.waitForTimeout(2000);

function hasGoodHit(): PdpHit | null {
  for (const h of captured) {
    if (h.status === 200 && !isBlocked(h.status, h.body)) {
      try {
        const j = JSON.parse(h.body);
        if (j?.data?.product_review) return h;
      } catch { /* */ }
    }
  }
  return null;
}

async function checkCaptchaUI(): Promise<boolean> {
  if (isCaptchaUrl(page.url())) return true;
  // Detecta widgets de captcha conhecidos
  try {
    const has = await page.evaluate(() => {
      const txts = ['Verifique', 'verify your', 'captcha', 'Verificação'];
      const html = document.body?.innerText ?? '';
      if (txts.some((t) => html.toLowerCase().includes(t.toLowerCase()))) return true;
      if (document.querySelector('iframe[src*="captcha"], iframe[src*="verify"]')) return true;
      return false;
    });
    return has;
  } catch { return false; }
}

// Loop: enquanto não tiver hit bom, ou der timeout.
let alerted = false;
const start = Date.now();
while (true) {
  const good = hasGoodHit();
  if (good) {
    log(`\n${GRN}✓ /pdp/get_pc devolveu OK${RST}`);
    break;
  }

  const captchaUi = await checkCaptchaUI();
  if ((captchaSeen || captchaUi) && !alerted) {
    alertCaptcha(`URL atual: ${page.url()}\nProduto-alvo: ${PRODUCT_URL}\nAssim que resolver, recarrego a página e capturo a request.`);
    alerted = true;
  }

  if (Date.now() - start > CAPTCHA_TIMEOUT_MS) {
    log(`\n${RED}✗ timeout aguardando resolução do captcha (${CAPTCHA_TIMEOUT_MS / 1000}s)${RST}`);
    break;
  }

  // Se alertamos e URL voltou pra um shopee.com.br normal, refaz o goto pra disparar /pdp/get_pc
  if (alerted && !isCaptchaUrl(page.url()) && !(await checkCaptchaUI())) {
    log(`  ${CYN}captcha resolvido aparentemente — recarregando produto…${RST}`);
    try {
      await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch { /* segue */ }
    await page.waitForTimeout(3000);
    alerted = false; // permite re-alerta se voltar
  }

  await page.waitForTimeout(2000);
}

log(`\n=== ${captured.length} response(s) /pdp/get_pc no total ===`);

const ok = hasGoodHit();
if (ok) {
  const json = JSON.parse(ok.body);
  const r = json.data.product_review;
  const it = json.data.item ?? {};
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = resolve(outDir, `cdp-pdp-${ITEM_ID}-${ts}.json`);
  await writeFile(file, ok.body, 'utf-8');
  log(`  salvo: out/cdp-pdp-${ITEM_ID}-${ts}.json`);
  log(`\n=== Campos de interesse ===`);
  log(`  item.name: ${it.title ?? it.name ?? '(?)'}`);
  log(`  historical_sold: ${r.historical_sold}`);
  log(`  historical_sold_display: ${r.historical_sold_display}`);
  log(`  global_sold: ${r.global_sold}`);
  log(`  global_sold_display: ${r.global_sold_display}`);
  log(`  cmt_count: ${r.cmt_count}`);
  log(`  total_rating_count: ${r.total_rating_count}`);
  log(`  liked_count: ${r.liked_count}`);
  log(`  rating_star: ${r.rating_star}`);
  log(`  rating_count: ${JSON.stringify(r.rating_count)}`);
} else {
  log(`\n${RED}✗ nenhuma response OK capturada${RST}`);
  for (const c of captured) {
    log(`  ${c.status} (${c.body.length}b) ${c.url}`);
    if (c.body.length < 500) log(`    body: ${c.body}`);
  }
}

log(`\n=== tempo total: ${Date.now() - t0}ms ===`);
// NÃO fecha o browser/página — perfil persiste pra próximos rodadas.
process.exit(0);
