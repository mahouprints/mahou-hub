import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ShopeeAffiliateClient,
  type GraphQLResponse,
} from './shopee/affiliate.client';
import {
  PRODUCT_OFFER_BY_CATEGORY,
  PRODUCT_OFFER_BY_KEYWORD,
  PRODUCT_OFFER_BY_SHOP,
  PRODUCT_OFFER_TOP,
  SHOP_OFFER,
  type AffiliateProductNode,
  type AffiliateShopNode,
} from './shopee/queries';

export type PaginateOpts = {
  limit?: number;
  pageSize?: number;
  sortType?: number;
  maxPages?: number;
  filter?: (node: AffiliateProductNode) => boolean;
};
import { resolveShop, type ShopDetailMobileWeb } from './shopee/username-resolver';

/**
 * Orquestra a integração com a Shopee Affiliate Open Platform.
 * Responsabilidades:
 *   1. Resolver URL/username → shopId via mobile-web pública.
 *   2. Buscar info da loja via shopOfferV2.
 *   3. Buscar TODOS os produtos da loja via productOfferV2 (paginando).
 */
@Injectable()
export class ShopeeAffiliateService {
  private readonly log = new Logger(ShopeeAffiliateService.name);
  private readonly client: ShopeeAffiliateClient;

  constructor(config: ConfigService) {
    const appId = config.get<string>('SHOPEE_AFFILIATE_APP_ID');
    const secret = config.get<string>('SHOPEE_AFFILIATE_SECRET');
    const endpoint =
      config.get<string>('SHOPEE_AFFILIATE_ENDPOINT') ??
      'https://open-api.affiliate.shopee.com.br/graphql';
    if (!appId || !secret) {
      throw new Error('SHOPEE_AFFILIATE_APP_ID / SHOPEE_AFFILIATE_SECRET não configurados');
    }
    this.client = new ShopeeAffiliateClient({ endpoint, appId, secret });
  }

  async resolveShopFromUrl(url: string): Promise<{ shopId: number; detail: ShopDetailMobileWeb }> {
    return resolveShop(url);
  }

  async fetchShop(shopId: number): Promise<AffiliateShopNode | null> {
    const res = await this.client.query<{ shopOfferV2: { nodes: AffiliateShopNode[] } }>(
      SHOP_OFFER,
      { shopId: String(shopId), limit: 1, page: 1 },
    );
    this.warnIfErrors('shopOfferV2', res);
    return res.data?.shopOfferV2?.nodes?.[0] ?? null;
  }

  // Pagina productOfferV2 até hasNextPage=false ou bater o limite de páginas.
  async fetchAllProducts(shopId: number, opts?: { pageSize?: number; maxPages?: number }): Promise<AffiliateProductNode[]> {
    const pageSize = opts?.pageSize ?? 50;
    const maxPages = opts?.maxPages ?? 20;
    const all: AffiliateProductNode[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const res = await this.client.query<{
        productOfferV2: { nodes: AffiliateProductNode[]; pageInfo: { hasNextPage: boolean } };
      }>(PRODUCT_OFFER_BY_SHOP, {
        shopId: String(shopId),
        limit: pageSize,
        page,
        sortType: 2, // 2 = comissão alta → relevância pra concorrência
      });
      this.warnIfErrors('productOfferV2', res);
      const nodes = res.data?.productOfferV2?.nodes ?? [];
      all.push(...nodes);
      const hasNext = res.data?.productOfferV2?.pageInfo?.hasNextPage;
      if (!hasNext || nodes.length === 0) break;
    }
    return all;
  }

  // Opts comuns das buscas paginadas. `filter` aplica por-página, parando quando bater limit
  // de produtos APROVADOS — evita devolver poucos itens quando o filtro é restritivo.
  // `maxPages` é cap defensivo (default 20 = até 1000 produtos brutos / loja).
  // Sem filter, mantém comportamento antigo (`all.length >= limit` corta).
  // Atenção: filter restritivo + maxPages baixo pode devolver menos que `limit`.
  // Aumente maxPages OU relaxe o filter quando isso acontecer.
  // Default sortType=2 (comissão alta) é melhor que sem ordenação pra qualidade percebida.

  // Busca direcionada por keyword (módulo Oportunidades — modo "buscar").
  async searchByKeyword(
    keyword: string,
    opts?: PaginateOpts,
  ): Promise<AffiliateProductNode[]> {
    return this.paginateProductOffer(PRODUCT_OFFER_BY_KEYWORD, { keyword }, opts);
  }

  // Busca direcionada por categoria Shopee. productCatId é Int (singular, conforme schema).
  async searchByCategory(
    productCatId: number,
    opts?: PaginateOpts,
  ): Promise<AffiliateProductNode[]> {
    return this.paginateProductOffer(PRODUCT_OFFER_BY_CATEGORY, { productCatId }, opts);
  }

  // Top vendas global (modo brainstorm). sortType=4 = mais vendidos (relevância pra brainstorm).
  async fetchTopOffers(opts?: PaginateOpts): Promise<AffiliateProductNode[]> {
    return this.paginateProductOffer(PRODUCT_OFFER_TOP, {}, { sortType: 4, ...opts });
  }

  // Paginação genérica de productOfferV2 com early-exit ao bater `limit` de aprovados (pós-filter).
  private async paginateProductOffer(
    query: string,
    extraVars: Record<string, unknown>,
    opts?: PaginateOpts,
  ): Promise<AffiliateProductNode[]> {
    const limit = opts?.limit ?? 200;
    const pageSize = opts?.pageSize ?? 50;
    const sortType = opts?.sortType ?? 2;
    const maxPages = opts?.maxPages ?? 20;
    const filter = opts?.filter;
    const matched: AffiliateProductNode[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const res = await this.client.query<{
        productOfferV2: { nodes: AffiliateProductNode[]; pageInfo: { hasNextPage: boolean } };
      }>(query, { ...extraVars, limit: pageSize, page, sortType });
      this.warnIfErrors('productOfferV2', res);
      const nodes = res.data?.productOfferV2?.nodes ?? [];
      for (const n of nodes) {
        if (!filter || filter(n)) matched.push(n);
        if (matched.length >= limit) return matched;
      }
      const hasNext = res.data?.productOfferV2?.pageInfo?.hasNextPage;
      if (!hasNext || nodes.length === 0) break;
    }
    return matched;
  }

  private warnIfErrors(label: string, res: GraphQLResponse<unknown>): void {
    if (res.errors?.length) {
      this.log.warn(`${label} retornou errors: ${JSON.stringify(res.errors)}`);
    }
  }
}
