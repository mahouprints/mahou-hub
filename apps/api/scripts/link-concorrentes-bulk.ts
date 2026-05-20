// Pega as lojas com URL Shopee em concorrentes-xlsx.json, faz match por nome com
// o que tem no banco (via GET /concorrentes), e dispara POST /concorrentes/:id/link-shopee
// pra cada match que ainda não tem shopId.
//
// Uso:
//   API_BASE=https://api.mahouprints.com ADMIN_EMAIL=... ADMIN_PASSWORD=... \
//     pnpm exec tsx scripts/link-concorrentes-bulk.ts
//   ou flag --local pra apontar contra dev local (http://localhost:3000).
//
// Logamos com cookie do /auth/login e reusamos pras chamadas seguintes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const JSON_PATH = resolve(__dirname, 'concorrentes-xlsx.json');

const args = process.argv.slice(2);
const local = args.includes('--local');
const dryRun = args.includes('--dry-run');
const API_BASE = local
  ? 'http://localhost:3000'
  : process.env.API_BASE ?? 'https://api.mahouprints.com';
const EMAIL = process.env.ADMIN_EMAIL ?? 'mahouprints@gmail.com';
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error('Defina ADMIN_PASSWORD no ambiente (ou cole inline: ADMIN_PASSWORD=xxx pnpm ...).');
  process.exit(1);
}

type LinhaXlsx = {
  loja: string;
  instagram: string | null;
  shopeeUrl: string | null;
  mercadoLivre: string | null;
  website: string | null;
  observacao: string | null;
};

type ConcorrenteListItem = {
  id: string;
  loja: string;
  shopId: string | null;
  username: string | null;
};

const linhas = JSON.parse(readFileSync(JSON_PATH, 'utf-8')) as LinhaXlsx[];
console.log(`API: ${API_BASE} | ${dryRun ? 'DRY RUN — sem POSTs' : 'ao vivo'}`);
console.log(`Linhas no xlsx: ${linhas.length}`);

// Estado de cookie (JWT vai vir no Set-Cookie do login).
let cookie = '';

function setCookieFromHeader(header: string | null) {
  if (!header) return;
  // Pode vir múltiplo separado por vírgulas, mas pra mahou_token só importa o primeiro
  // (o cookie é HttpOnly e o backend só seta um).
  const token = header.split(';')[0]!;
  cookie = token;
}

async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(rest.headers as Record<string, string> | undefined),
    },
    body: json !== undefined ? JSON.stringify(json) : (rest.body as BodyInit | undefined),
  });
  setCookieFromHeader(res.headers.get('set-cookie'));
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} em ${path}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as T;
}

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('Logando…');
  await api('/auth/login', { method: 'POST', json: { email: EMAIL, senha: PASSWORD } });
  console.log(`✓ logado como ${EMAIL}`);

  const concorrentes = await api<ConcorrenteListItem[]>('/concorrentes');
  console.log(`Concorrentes no banco: ${concorrentes.length}`);

  const indice = new Map<string, ConcorrenteListItem>();
  for (const c of concorrentes) indice.set(normalizar(c.loja), c);

  const comShopee = linhas.filter((l) => l.shopeeUrl);
  let ok = 0;
  let skipped = 0;
  let semMatch = 0;
  let falhou = 0;

  for (const linha of comShopee) {
    const match = indice.get(normalizar(linha.loja));
    if (!match) {
      console.log(`✗ "${linha.loja}" — sem match no banco`);
      semMatch++;
      continue;
    }
    if (match.shopId) {
      console.log(`· "${linha.loja}" → ${match.id} já tem shopId=${match.shopId}, pulando`);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`[dry] "${linha.loja}" → ${match.id} ← ${linha.shopeeUrl}`);
      ok++;
      continue;
    }
    process.stdout.write(`→ "${linha.loja}" linkando ${linha.shopeeUrl}… `);
    try {
      await api(`/concorrentes/${match.id}/link-shopee`, { method: 'POST', json: { url: linha.shopeeUrl } });
      console.log('OK');
      ok++;
    } catch (err) {
      console.log(`FAIL: ${err instanceof Error ? err.message : err}`);
      falhou++;
    }
    // Pequena pausa entre requests pra não bombardear a Affiliate
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\n=== Resumo ===');
  console.log(`OK:            ${ok}`);
  console.log(`Já linkados:   ${skipped}`);
  console.log(`Sem match:     ${semMatch}`);
  console.log(`Falharam:      ${falhou}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
