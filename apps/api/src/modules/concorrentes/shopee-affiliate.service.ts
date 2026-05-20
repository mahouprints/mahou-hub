import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ShopeeAffiliateClient,
  type GraphQLResponse,
} from './shopee/affiliate.client';
import {
  PRODUCT_OFFER_BY_SHOP,
  SHOP_OFFER,
  type AffiliateProductNode,
  type AffiliateShopNode,
} from './shopee/queries';
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

  private warnIfErrors(label: string, res: GraphQLResponse<unknown>): void {
    if (res.errors?.length) {
      this.log.warn(`${label} retornou errors: ${JSON.stringify(res.errors)}`);
    }
  }
}
