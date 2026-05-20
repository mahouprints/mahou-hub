// Entrypoint do reconhecimento. Comandos:
//   tsx src/explore.ts schema      → introspection completa do Query root + tipos relevantes
//   tsx src/explore.ts produtos    → productOfferV2 sem filtro (top ofertas)
//   tsx src/explore.ts keyword     → productOfferV2 com keyword "filamento"
//   tsx src/explore.ts loja        → productOfferV2 + shopOfferV2 pra um shopId
//   tsx src/explore.ts categorias  → tenta inferir lista de categorias a partir das top ofertas
//   tsx src/explore.ts all         → roda todos em sequência
//
// Os resultados crus são salvos em out/<comando>-<timestamp>.json pra inspeção posterior.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gql } from './client.js';
import {
  PRODUCT_OFFER_BY_CATEGORY,
  PRODUCT_OFFER_BY_KEYWORD,
  PRODUCT_OFFER_BY_SHOP,
  PRODUCT_OFFER_TOP,
  SHOP_OFFER,
} from './queries.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../out');

async function save(name: string, body: unknown) {
  await mkdir(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = resolve(outDir, `${name}-${ts}.json`);
  await writeFile(file, JSON.stringify(body, null, 2), 'utf-8');
  return file;
}

function preview(value: unknown, depth = 0): string {
  if (value == null) return String(value);
  if (Array.isArray(value)) {
    const sample = value.slice(0, 2);
    return `[${value.length}] ${JSON.stringify(sample, null, 2)}`;
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

async function runSchema() {
  console.log('→ Introspection do Query root e tipos relevantes\n');
  const query = /* GraphQL */ `
    query Schema {
      __schema {
        queryType { name }
        types {
          name
          kind
          description
        }
      }
      productOfferType: __type(name: "ProductOfferV2") {
        name
        fields { name type { name kind ofType { name kind } } description }
      }
      productOfferNodeType: __type(name: "ProductOfferV2Node") {
        name
        fields { name type { name kind ofType { name kind } } description }
      }
      shopOfferType: __type(name: "ShopOfferV2") {
        name
        fields { name type { name kind ofType { name kind } } description }
      }
      shopOfferNodeType: __type(name: "ShopOfferV2Node") {
        name
        fields { name type { name kind ofType { name kind } } description }
      }
      rootFields: __type(name: "Query") {
        fields {
          name
          description
          args { name type { name kind ofType { name kind } } }
        }
      }
    }
  `;
  const res = await gql<Record<string, unknown>>(query);
  if (res.errors) console.warn('errors:', res.errors);
  const file = await save('schema', res);

  // Resumo legível
  const data = res.data as any;
  const root = data?.rootFields?.fields ?? [];
  console.log(`Queries disponíveis no Query root (${root.length}):`);
  for (const f of root) {
    const args = (f.args ?? [])
      .map((a: any) => `${a.name}:${a.type.name ?? a.type.ofType?.name ?? a.type.kind}`)
      .join(', ');
    console.log(`  · ${f.name}(${args})`);
    if (f.description) console.log(`      ${f.description}`);
  }

  for (const key of ['productOfferType', 'productOfferNodeType', 'shopOfferType', 'shopOfferNodeType']) {
    const t = data?.[key];
    if (!t) continue;
    console.log(`\n${t.name} fields:`);
    for (const f of t.fields ?? []) {
      const tn = f.type?.name ?? f.type?.ofType?.name ?? f.type?.kind;
      console.log(`  · ${f.name}: ${tn}${f.description ? ` — ${f.description}` : ''}`);
    }
  }

  console.log(`\nSalvo em: ${file}`);
}

async function runProdutos(categoryId?: number) {
  console.log(`→ productOfferV2 ${categoryId ? `(productCatId=${categoryId})` : '(sem filtro, top ofertas)'}\n`);
  const query = categoryId ? PRODUCT_OFFER_BY_CATEGORY : PRODUCT_OFFER_TOP;
  const variables: Record<string, unknown> = { limit: 5, page: 1, sortType: 2 };
  if (categoryId) variables.productCatId = categoryId;
  const res = await gql<{ productOfferV2: { nodes: Array<Record<string, unknown>>; pageInfo: Record<string, unknown> } }>(
    query,
    variables,
  );
  if (res.errors) console.warn('errors:', JSON.stringify(res.errors, null, 2));
  const file = await save('produtos', res);
  const nodes = res.data?.productOfferV2?.nodes ?? [];
  console.log(`Recebidos ${nodes.length} produto(s). Campos da primeira oferta:`);
  if (nodes[0]) for (const [k, v] of Object.entries(nodes[0])) console.log(`  · ${k}: ${preview(v)}`);
  console.log(`pageInfo:`, res.data?.productOfferV2?.pageInfo);
  console.log(`\nSalvo em: ${file}`);
  return nodes;
}

async function runKeyword(keyword = 'filamento') {
  console.log(`→ productOfferV2 (keyword="${keyword}")\n`);
  const res = await gql<{ productOfferV2: { nodes: Array<Record<string, unknown>>; pageInfo: Record<string, unknown> } }>(
    PRODUCT_OFFER_BY_KEYWORD,
    { keyword, limit: 5, page: 1, sortType: 2 },
  );
  if (res.errors) console.warn('errors:', JSON.stringify(res.errors, null, 2));
  const file = await save('keyword', res);
  const nodes = res.data?.productOfferV2?.nodes ?? [];
  console.log(`Recebidos ${nodes.length} produto(s).`);
  for (const n of nodes) {
    console.log(`  · [${n.itemId}] ${n.productName} — shop=${n.shopName} (${n.shopId}) preço=${n.priceMin}-${n.priceMax} comm=${n.commissionRate}`);
  }
  console.log(`\nSalvo em: ${file}`);
  return nodes;
}

// Resolve username (slug da URL shopee.com.br/<username>) pra shopId via API pública mobile-web da Shopee.
// Essa rota é a mesma que o site usa pra carregar a página da loja; não precisa de auth.
async function resolveShopByUsername(username: string): Promise<{ shopId: number; raw: unknown }> {
  const url = `https://shopee.com.br/api/v4/shop/get_shop_detail?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; mahou-hub-explore/0.1)',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`mobile-web HTTP ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const shopId = data?.data?.shopid;
  if (!shopId) throw new Error(`Resposta sem shopid: ${text.slice(0, 400)}`);
  return { shopId, raw: data?.data };
}

async function runLoja(shopArg?: number | string) {
  // Aceita: número (shopId direto), string numérica (shopId), ou string com username/URL.
  let finalShopId: number | undefined;
  let shopDetail: any;
  if (typeof shopArg === 'string' && !/^\d+$/.test(shopArg)) {
    // É username ou URL
    const username = shopArg.replace(/^https?:\/\/shopee\.com\.br\//, '').replace(/^\//, '').split('/')[0]!;
    console.log(`Resolvendo username "${username}" via mobile-web…`);
    const resolved = await resolveShopByUsername(username);
    finalShopId = resolved.shopId;
    shopDetail = resolved.raw;
    console.log(`shopId=${finalShopId}`);
    if (shopDetail) {
      console.log(`\nCampos públicos da loja (mobile-web /shop/get_shop_detail):`);
      const interessantes = ['name', 'shopid', 'userid', 'follower_count', 'rating_star', 'item_count', 'response_rate', 'response_time', 'shop_location', 'is_official_shop', 'is_preferred_plus_seller', 'cb_option', 'last_active_time', 'ctime', 'description'];
      for (const k of interessantes) if (k in shopDetail) console.log(`  · ${k}: ${preview(shopDetail[k])}`);
    }
    await save('loja-username', shopDetail);
    console.log('');
  } else if (shopArg) {
    finalShopId = Number(shopArg);
  }
  if (!finalShopId) {
    console.log('Sem shopId/username — pegando o shop da primeira oferta de "filamento" pra usar de exemplo…\n');
    const nodes = await runKeyword('filamento');
    finalShopId = nodes[0]?.shopId as number | undefined;
    if (!finalShopId) {
      console.warn('Não consegui inferir um shopId. Passe número, username ou URL: tsx src/explore.ts loja <id|username|url>');
      return;
    }
    console.log(`\nUsando shopId=${finalShopId}\n`);
  }
  console.log(`→ shopOfferV2 (shopId=${finalShopId})`);
  // Int64 precisa ser enviado como string em JSON (Number do JS perde precisão > 2^53).
  const shopRes = await gql<{ shopOfferV2: { nodes: Array<Record<string, unknown>> } }>(
    SHOP_OFFER,
    { shopId: String(finalShopId), limit: 5, page: 1 },
  );
  if (shopRes.errors) console.warn('shopOffer errors:', JSON.stringify(shopRes.errors, null, 2));
  const shopFile = await save('loja-shop', shopRes);
  const shopNode = shopRes.data?.shopOfferV2?.nodes?.[0];
  if (shopNode) {
    console.log('\nCampos da loja:');
    for (const [k, v] of Object.entries(shopNode)) console.log(`  · ${k}: ${preview(v)}`);
  } else {
    console.log('Nenhuma loja retornada por shopOfferV2 (a loja pode não estar no programa de afiliados).');
  }

  console.log(`\n→ productOfferV2 (shopId=${finalShopId})`);
  const prodRes = await gql<{ productOfferV2: { nodes: Array<Record<string, unknown>> } }>(
    PRODUCT_OFFER_BY_SHOP,
    { shopId: String(finalShopId), limit: 5, page: 1, sortType: 2 },
  );
  if (prodRes.errors) console.warn('productOffer errors:', JSON.stringify(prodRes.errors, null, 2));
  const prodFile = await save('loja-produtos', prodRes);
  const nodes = prodRes.data?.productOfferV2?.nodes ?? [];
  console.log(`Recebidos ${nodes.length} produto(s) da loja.`);
  for (const n of nodes) {
    console.log(`  · [${n.itemId}] ${n.productName} — preço=${n.priceMin}-${n.priceMax} sales=${n.sales} comm=${n.commissionRate}`);
  }
  console.log(`\nSalvo em: ${shopFile}\n          ${prodFile}`);
}

async function runCategorias() {
  console.log('→ Inferindo categorias a partir das top ofertas (a Shopee não expõe lista nominal direta na API de afiliados)\n');
  const nodes = await runProdutos();
  const cats = new Map<string, number>();
  for (const n of nodes) {
    const ids = (n.productCatIds as unknown as number[] | undefined) ?? [];
    for (const id of ids) cats.set(String(id), (cats.get(String(id)) ?? 0) + 1);
  }
  console.log('\nIDs de categoria encontrados nas ofertas amostradas:');
  for (const [id, n] of cats) console.log(`  · ${id} (${n}x)`);
  console.log('\nObs: cada produto vem com array productCatIds — top-level depois nível, raramente nome. Pra mapear nome→id usaria-se /api/v4/pages/get_category_tree do mobile-web, fora da API de afiliados.');
}

// Paginação completa dos produtos de uma loja. Itera até hasNextPage=false ou bater o cap.
async function runLojaTudo(shopArg: string, limitPorPagina = 50, maxPaginas = 20) {
  let shopId: number;
  if (/^\d+$/.test(shopArg)) {
    shopId = Number(shopArg);
  } else {
    const username = shopArg.replace(/^https?:\/\/shopee\.com\.br\//, '').replace(/^\//, '').split('/')[0]!;
    console.log(`Resolvendo "${username}"…`);
    shopId = (await resolveShopByUsername(username)).shopId;
    console.log(`shopId=${shopId}\n`);
  }

  const todos: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= maxPaginas; page++) {
    const res = await gql<{ productOfferV2: { nodes: Array<Record<string, unknown>>; pageInfo: { hasNextPage: boolean } } }>(
      PRODUCT_OFFER_BY_SHOP,
      { shopId: String(shopId), limit: limitPorPagina, page, sortType: 2 },
    );
    if (res.errors) {
      console.warn(`Página ${page} errors:`, JSON.stringify(res.errors, null, 2));
      break;
    }
    const nodes = res.data?.productOfferV2?.nodes ?? [];
    todos.push(...nodes);
    const hasNext = res.data?.productOfferV2?.pageInfo?.hasNextPage;
    console.log(`Página ${page}: +${nodes.length} (total acumulado: ${todos.length}, hasNextPage=${hasNext})`);
    if (!hasNext || nodes.length === 0) break;
  }

  await save(`loja-tudo-${shopId}`, todos);

  // Ordena por sales desc pra inspeção
  const ordenado = [...todos].sort((a, b) => Number(b.sales ?? 0) - Number(a.sales ?? 0));
  console.log(`\nTotal coletado: ${todos.length} produto(s). Top por sales (Affiliate):\n`);
  for (const n of ordenado) {
    const sales = String(n.sales ?? 0).padStart(5);
    const comm = ((Number(n.commissionRate) || 0) * 100).toFixed(0).padStart(3);
    const preco = `R$${Number(n.priceMin).toFixed(2)}${n.priceMin !== n.priceMax ? `-${Number(n.priceMax).toFixed(2)}` : ''}`;
    console.log(`  ${sales}v  ${comm}%  ${preco.padEnd(18)} [${n.itemId}] ${n.productName}`);
  }

  const totalSales = todos.reduce((s, n) => s + Number(n.sales ?? 0), 0);
  console.log(`\nSoma de sales (via afiliado) = ${totalSales}`);
}

// Descoberta de campos: tenta vários campos especulativos numa única query e separa válidos de inválidos via erros.
async function runDescobrirCampos() {
  const candidatos = [
    // já confirmados (mantidos)
    'itemId', 'productName', 'commissionRate', 'commission', 'sales',
    'priceMin', 'priceMax', 'price', 'priceDiscountRate', 'imageUrl', 'productLink', 'offerLink',
    'periodStartTime', 'periodEndTime', 'shopId', 'shopName', 'shopType',
    'productCatIds', 'ratingStar',
    // candidatos pra "vendas" totais ou números de afiliado
    'historicalSold', 'historicalSale', 'globalSold', 'totalSold', 'orderCount',
    'numberSold', 'sold', 'liked', 'cmtCount', 'liked_count',
    // candidatos pra quantidade de avaliações
    'ratingCount', 'reviewCount', 'commentCount', 'numRatings', 'ratingTotal',
    'totalRating', 'ratingsCount', 'ratingNum', 'numReviews', 'ratingNumber',
    // visualizações / engajamento
    'viewCount', 'views', 'likes', 'likeCount',
    // status / categoria
    'isMall', 'isPreferredSeller', 'isAMSOffer', 'isKeySeller',
    'discount', 'discountPercent', 'description', 'shopRating',
    'productCategoryNames', 'category', 'modelCount',
  ];
  const query = `query { productOfferV2(limit: 1, page: 1) { nodes { ${candidatos.join('\n')} } } }`;
  const res = await gql<{ productOfferV2: { nodes: Array<Record<string, unknown>> } }>(query);
  const invalidos = new Set<string>();
  for (const e of res.errors ?? []) {
    const m = /Cannot query field "([^"]+)"/.exec(e.message);
    if (m) invalidos.add(m[1]!);
  }
  const validos = candidatos.filter((c) => !invalidos.has(c));
  console.log(`Campos VÁLIDOS em ProductOfferV2 (${validos.length}/${candidatos.length}):`);
  for (const c of validos) console.log(`  · ${c}`);
  console.log(`\nCampos INVÁLIDOS (${invalidos.size}):`);
  for (const c of invalidos) console.log(`  · ${c}`);

  // Re-query só com os válidos pra ver os valores
  if (validos.length > 0) {
    const q2 = `query { productOfferV2(limit: 1, page: 1) { nodes { ${validos.join('\n')} } } }`;
    const res2 = await gql<{ productOfferV2: { nodes: Array<Record<string, unknown>> } }>(q2);
    if (res2.errors) console.warn('Pós-filtro ainda com erros:', res2.errors);
    const node = res2.data?.productOfferV2?.nodes?.[0];
    if (node) {
      console.log('\nExemplo de retorno:');
      for (const [k, v] of Object.entries(node)) console.log(`  · ${k}: ${preview(v)}`);
    }
    await save('campos', { validos, invalidos: [...invalidos], exemplo: node });
  }
}

const cmd = process.argv[2] ?? 'all';
const arg = process.argv[3];

try {
  switch (cmd) {
    case 'schema':
      await runSchema();
      break;
    case 'produtos':
      await runProdutos(arg ? Number(arg) : undefined);
      break;
    case 'keyword':
      await runKeyword(arg);
      break;
    case 'loja':
      await runLoja(arg);
      break;
    case 'loja-tudo':
      if (!arg) throw new Error('Uso: tsx src/explore.ts loja-tudo <username|shopId|URL>');
      await runLojaTudo(arg);
      break;
    case 'campos':
      await runDescobrirCampos();
      break;
    case 'categorias':
      await runCategorias();
      break;
    case 'all':
      await runSchema();
      console.log('\n' + '─'.repeat(60) + '\n');
      await runProdutos();
      console.log('\n' + '─'.repeat(60) + '\n');
      await runKeyword();
      console.log('\n' + '─'.repeat(60) + '\n');
      await runLoja();
      break;
    default:
      console.error(`Comando desconhecido: ${cmd}. Use schema | produtos | keyword | loja | loja-tudo | campos | categorias | all`);
      process.exit(1);
  }
} catch (err) {
  console.error('Falha:', err instanceof Error ? err.message : err);
  process.exit(1);
}
