// Smoke test fim-a-fim do módulo Oportunidades. Roda contra api LOCAL (default http://localhost:3000).
//
// Pré-requisitos:
//   - API rodando: `pnpm dev` ou `pnpm --filter api start:dev`
//   - Login admin existente no banco (em dev: mahouprints@gmail.com / 12345678)
//   - Variáveis Shopee no .env (SHOPEE_AFFILIATE_APP_ID, SHOPEE_AFFILIATE_SECRET)
//
// Uso:
//   pnpm --filter api exec tsx scripts/smoke-oportunidades.ts
//
// Faz:
//   1. Login → pega JWT
//   2. GET /oportunidades/categorias-3d (sanity)
//   3. POST /oportunidades/explorar (chama Shopee real — pode demorar ~5s)
//   4. POST /oportunidades (salva 1 candidato)
//   5. POST /oportunidades/bulk (salva mais 2)
//   6. GET /oportunidades?status=EM_ANALISE
//   7. POST /oportunidades/:id/virar-produto (cria rascunho)
//   8. DELETE oportunidades e produto criados (cleanup)

const API_URL = process.env.MAHOU_API_URL ?? 'http://localhost:3000';
const EMAIL = process.env.MAHOU_ADMIN_EMAIL ?? 'mahouprints@gmail.com';
const SENHA = process.env.MAHOU_ADMIN_SENHA ?? '12345678';

let token = '';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Login devolve JWT via cookie httpOnly `mahou_token`. Extrai do Set-Cookie.
async function loginAndGetToken(email: string, senha: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  if (!res.ok) {
    throw new Error(`POST /auth/login → ${res.status}: ${await res.text()}`);
  }
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/mahou_token=([^;]+)/);
  if (!match) {
    throw new Error(`Login OK mas cookie mahou_token não veio no Set-Cookie: ${setCookie}`);
  }
  return match[1]!;
}

function ok(msg: string) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}
function info(msg: string) {
  console.log(`  \x1b[2m${msg}\x1b[0m`);
}

async function main() {
  console.log(`Smoke test: ${API_URL}\n`);

  // 1. Login (token vem no Set-Cookie httpOnly, não no body — extrai manualmente).
  token = await loginAndGetToken(EMAIL, SENHA);
  ok(`Login OK (${EMAIL})`);

  // 2. Categorias 3D
  const cats = await call<Array<{ id: number; nome: string }>>('GET', '/oportunidades/categorias-3d');
  ok(`GET /categorias-3d → ${cats.length} categorias`);
  for (const c of cats.slice(0, 3)) info(`  ${c.id} = ${c.nome}`);

  // 3. Explorar Shopee real
  console.log('\n→ Chamando Shopee Affiliate (pode demorar)…');
  const explorados = await call<Array<{ externalId: string; productName: string; vendasEstimadasMes: number; priceMinCentavos: number }>>(
    'POST',
    '/oportunidades/explorar',
    { marketplace: 'SHOPEE', filtros: { vendasMin: 200, precoMinCentavos: 2000, precoMaxCentavos: 15000, ratingMin: 4, limit: 10 } },
  );
  if (explorados.length === 0) throw new Error('Shopee não devolveu nada — verifique credenciais Affiliate.');
  ok(`POST /explorar → ${explorados.length} candidatos`);
  for (const e of explorados.slice(0, 3)) {
    info(`  ${e.externalId} · ${e.productName.slice(0, 60)} · R$${(e.priceMinCentavos / 100).toFixed(2)} · ~${e.vendasEstimadasMes}/mês`);
  }

  // Validações de coerência
  for (const e of explorados) {
    if (e.vendasEstimadasMes < 200) throw new Error(`Filtro vendasMin não foi respeitado: ${e.externalId} tem ${e.vendasEstimadasMes}`);
    if (e.priceMinCentavos < 2000 || e.priceMinCentavos > 15000)
      throw new Error(`Filtro preço não foi respeitado: ${e.externalId} tem ${e.priceMinCentavos}`);
  }
  ok('Filtros server-side foram respeitados (preço + vendas)');

  // 4. Salvar 1 candidato
  const primeiro = explorados[0]!;
  const salvo = await call<{ id: string; externalId: string; status: string }>(
    'POST',
    '/oportunidades',
    {
      marketplace: 'SHOPEE',
      externalId: primeiro.externalId,
      productName: primeiro.productName,
      priceMinCentavos: primeiro.priceMinCentavos,
      priceMaxCentavos: primeiro.priceMinCentavos,
      imageUrl: 'https://placeholder/test.jpg',
      productLink: 'https://shopee.com.br/smoke-test',
      vendasEstimadasMes: primeiro.vendasEstimadasMes,
      ratingStar: 4.5,
      categoriaIds: [],
      fonte: 'TOP_VENDAS',
      status: 'EM_ANALISE',
      score: 75,
      notas: '[SMOKE TEST] análise gerada por scripts/smoke-oportunidades.ts',
    },
  );
  ok(`POST / → criado id=${salvo.id.slice(0, 8)}… status=${salvo.status}`);

  // 5. Salvar 2 em bulk (com os próximos da lista)
  const proximos = explorados.slice(1, 3);
  const bulk = await call<{ count: number; ids: string[] }>('POST', '/oportunidades/bulk', {
    itens: proximos.map((p) => ({
      marketplace: 'SHOPEE' as const,
      externalId: p.externalId,
      productName: p.productName,
      priceMinCentavos: p.priceMinCentavos,
      priceMaxCentavos: p.priceMinCentavos,
      imageUrl: 'https://placeholder/test.jpg',
      productLink: 'https://shopee.com.br/smoke-test-bulk',
      vendasEstimadasMes: p.vendasEstimadasMes,
      ratingStar: 4.4,
      categoriaIds: [],
      fonte: 'TOP_VENDAS' as const,
      status: 'EM_ANALISE' as const,
      score: 70,
      notas: '[SMOKE TEST] bulk',
    })),
  });
  ok(`POST /bulk → ${bulk.count} salvos`);

  // 6. Listar EM_ANALISE
  const lista = await call<Array<{ id: string; status: string }>>('GET', '/oportunidades?status=EM_ANALISE&take=500');
  const smokeIds = [salvo.id, ...bulk.ids];
  const presentes = lista.filter((o) => smokeIds.includes(o.id));
  if (presentes.length !== smokeIds.length) {
    throw new Error(`Esperava ${smokeIds.length} itens nossos em EM_ANALISE, encontrei ${presentes.length}`);
  }
  ok(`GET /?status=EM_ANALISE → ${lista.length} total, ${presentes.length} smoke-test presentes`);

  // 7. Virar produto (rascunho — sem filamento/peso/tempo). Precisa ter filamento ativo no banco.
  // Se não tiver, skipa (cenário comum em dev local zero).
  let produtoRascunhoId: string | null = null;
  const filamentos = await call<Array<{ id: string; ativo: boolean }>>('GET', '/filamentos');
  const temFilamentoAtivo = filamentos.some((f) => f.ativo);
  if (temFilamentoAtivo) {
    const produtoRascunho = await call<{ id: string; rascunho: boolean; ativo: boolean }>(
      'POST',
      `/oportunidades/${salvo.id}/virar-produto`,
      {},
    );
    if (!produtoRascunho.rascunho) throw new Error('Esperava rascunho=true mas veio false');
    if (produtoRascunho.ativo) throw new Error('Rascunho deveria ter ativo=false');
    produtoRascunhoId = produtoRascunho.id;
    ok(`POST /:id/virar-produto → produto id=${produtoRascunho.id.slice(0, 8)}… (rascunho=true, ativo=false)`);
  } else {
    info('skip virar-produto: nenhum filamento ativo no banco (esperado em dev zero)');
  }

  // 7b. Histórico — confirma que audit log capturou os eventos.
  const hist = await call<Array<{ acao: string }>>(
    'GET',
    `/oportunidades/${salvo.id}/historico`,
  );
  if (hist.length === 0) throw new Error('Histórico vazio — audit log não está rodando');
  const acoes = hist.map((h) => h.acao).join(', ');
  ok(`GET /:id/historico → ${hist.length} eventos (${acoes})`);

  // 8. Cleanup
  console.log('\n→ Cleanup…');
  if (produtoRascunhoId) {
    await call('DELETE', `/produtos/${produtoRascunhoId}`);
    ok('Produto rascunho deletado');
  }
  await call('POST', '/oportunidades/bulk-delete', { ids: smokeIds });
  ok(`${smokeIds.length} oportunidades deletadas`);

  console.log('\n\x1b[32m✓ Todos os checks passaram\x1b[0m');
}

main().catch((err) => {
  console.error(`\n\x1b[31m✗ Falhou: ${err.message}\x1b[0m`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
