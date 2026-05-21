// Descobre IDs de categorias Shopee BR que aparecem com frequência em produtos
// relevantes pra impressão 3D. Roda buscas por keywords típicas + top vendas,
// agrega `productCatIds` e reporta os mais comuns.
//
// Uso:
//   pnpm --filter api exec tsx scripts/discover-shopee-categories.ts
//
// Saída: tabela com `catId | freq | exemplo de produto`.
// Depois você cura manualmente e atualiza `src/modules/oportunidades/providers/shopee-categorias-3d.ts`.
//
// Custo: ~10 chamadas à Shopee Affiliate (1 top + 9 keywords × 1 página cada).
// Cada chamada conta no rate-limit do app — rodar 1x por mês é suficiente.

import { config } from 'dotenv';
import path from 'path';

// __dirname existe em CommonJS (que é como tsx roda esse projeto).
config({ path: path.resolve(__dirname, '../.env') });

import { ShopeeAffiliateClient } from '../src/modules/concorrentes/shopee/affiliate.client';
import {
  PRODUCT_OFFER_BY_KEYWORD,
  PRODUCT_OFFER_TOP,
  type AffiliateProductNode,
} from '../src/modules/concorrentes/shopee/queries';

const KEYWORDS_3D = [
  'porta controle',
  'organizador gaveta',
  'suporte celular',
  'miniatura',
  'vaso decorativo',
  'porta fone',
  'gancho parede',
  'porta trecos',
  'suporte headset',
];

const PAGE_SIZE = 50;
const MIN_FREQ = 3; // só reporta catIds que apareceram >=3 vezes

function buildClient() {
  const appId = process.env.SHOPEE_AFFILIATE_APP_ID;
  const secret = process.env.SHOPEE_AFFILIATE_SECRET;
  const endpoint =
    process.env.SHOPEE_AFFILIATE_ENDPOINT ??
    'https://open-api.affiliate.shopee.com.br/graphql';
  if (!appId || !secret) {
    throw new Error('SHOPEE_AFFILIATE_APP_ID e SHOPEE_AFFILIATE_SECRET precisam estar no .env');
  }
  return new ShopeeAffiliateClient({ endpoint, appId, secret });
}

async function fetchNodes(
  client: ShopeeAffiliateClient,
  label: string,
  query: string,
  vars: Record<string, unknown>,
): Promise<AffiliateProductNode[]> {
  process.stdout.write(`  ${label}… `);
  const res = await client.query<{
    productOfferV2: { nodes: AffiliateProductNode[] };
  }>(query, { ...vars, limit: PAGE_SIZE, page: 1 });
  const nodes = res.data?.productOfferV2?.nodes ?? [];
  console.log(`${nodes.length} produtos`);
  if (res.errors?.length) console.log(`    [errors] ${JSON.stringify(res.errors)}`);
  return nodes;
}

type CatStats = { freq: number; exemplos: string[] };

async function main() {
  console.log(`Descoberta de categorias Shopee BR pra impressão 3D\n`);
  const client = buildClient();
  const allNodes: AffiliateProductNode[] = [];

  // Top vendas global (sortType=4)
  const top = await fetchNodes(client, '[top vendas]', PRODUCT_OFFER_TOP, { sortType: 4 });
  allNodes.push(...top);

  // Por keyword (sortType=4 = mais vendidos)
  for (const kw of KEYWORDS_3D) {
    const nodes = await fetchNodes(client, `[kw: ${kw}]`, PRODUCT_OFFER_BY_KEYWORD, {
      keyword: kw,
      sortType: 4,
    });
    allNodes.push(...nodes);
  }

  // Agrega: catId → { freq, 3 nomes de produto como exemplo }
  const stats = new Map<number, CatStats>();
  for (const n of allNodes) {
    for (const catId of n.productCatIds ?? []) {
      const id = Math.trunc(Number(catId));
      if (!Number.isFinite(id) || id <= 0) continue;
      const cur = stats.get(id) ?? { freq: 0, exemplos: [] };
      cur.freq++;
      if (cur.exemplos.length < 3) cur.exemplos.push(n.productName.slice(0, 50));
      stats.set(id, cur);
    }
  }

  // Ordena por frequência desc
  const ranked = [...stats.entries()]
    .filter(([, s]) => s.freq >= MIN_FREQ)
    .sort(([, a], [, b]) => b.freq - a.freq);

  console.log(`\nTotal produtos varridos: ${allNodes.length}`);
  console.log(`Categorias únicas: ${stats.size}`);
  console.log(`Frequentes (>= ${MIN_FREQ}): ${ranked.length}\n`);

  console.log('catId      | freq | exemplos');
  console.log('-----------|------|--------------------------------------------');
  for (const [catId, s] of ranked.slice(0, 30)) {
    const ex = s.exemplos.join(' | ').slice(0, 90);
    console.log(`${catId.toString().padStart(10)} | ${s.freq.toString().padStart(4)} | ${ex}`);
  }

  console.log(
    '\nEscolha os IDs que fazem sentido pra 3D e atualize ' +
      '`src/modules/oportunidades/providers/shopee-categorias-3d.ts`.\n' +
      'Repita esta varredura 1x/mês ou quando perceber categorias novas no mercado.',
  );
}

main().catch((err) => {
  console.error(`\n✗ Falhou: ${err.message}`);
  process.exit(1);
});
