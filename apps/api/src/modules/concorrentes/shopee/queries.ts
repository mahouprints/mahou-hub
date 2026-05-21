// Queries GraphQL da Shopee Affiliate. Os 19 campos de ProductOfferV2 e 11 de ShopOfferV2
// foram confirmados via descoberta forçada — introspection da API está desabilitada.
// Veja scripts/shopee-affiliate/ pra histórico completo de exploração.

const PRODUCT_NODE_FIELDS = /* GraphQL */ `
  itemId
  productName
  commissionRate
  commission
  sales
  priceMin
  priceMax
  priceDiscountRate
  imageUrl
  productLink
  offerLink
  periodStartTime
  periodEndTime
  shopId
  shopName
  shopType
  productCatIds
  ratingStar
`;

// shopId é Int64 — passar como string na variável.
export const PRODUCT_OFFER_BY_SHOP = /* GraphQL */ `
  query ProdutosPorLoja($shopId: Int64, $limit: Int, $page: Int, $sortType: Int) {
    productOfferV2(shopId: $shopId, limit: $limit, page: $page, sortType: $sortType) {
      nodes { ${PRODUCT_NODE_FIELDS} }
      pageInfo { page limit hasNextPage scrollId }
    }
  }
`;

// Busca por palavra-chave — usada pelo módulo Oportunidades (descoberta direcionada).
export const PRODUCT_OFFER_BY_KEYWORD = /* GraphQL */ `
  query ProdutosPorKeyword($keyword: String, $limit: Int, $page: Int, $sortType: Int) {
    productOfferV2(keyword: $keyword, limit: $limit, page: $page, sortType: $sortType) {
      nodes { ${PRODUCT_NODE_FIELDS} }
      pageInfo { page limit hasNextPage scrollId }
    }
  }
`;

// Busca por categoria Shopee (productCatId no singular, descoberto via erro do servidor).
export const PRODUCT_OFFER_BY_CATEGORY = /* GraphQL */ `
  query ProdutosPorCategoria($productCatId: Int, $limit: Int, $page: Int, $sortType: Int) {
    productOfferV2(productCatId: $productCatId, limit: $limit, page: $page, sortType: $sortType) {
      nodes { ${PRODUCT_NODE_FIELDS} }
      pageInfo { page limit hasNextPage scrollId }
    }
  }
`;

// Top global sem filtro — usado no modo brainstorm. Filtros de qualidade (vendas, preço) são aplicados no provider.
export const PRODUCT_OFFER_TOP = /* GraphQL */ `
  query ProdutosTop($limit: Int, $page: Int, $sortType: Int) {
    productOfferV2(limit: $limit, page: $page, sortType: $sortType) {
      nodes { ${PRODUCT_NODE_FIELDS} }
      pageInfo { page limit hasNextPage scrollId }
    }
  }
`;

export const SHOP_OFFER = /* GraphQL */ `
  query Loja($shopId: Int64, $limit: Int, $page: Int) {
    shopOfferV2(shopId: $shopId, limit: $limit, page: $page) {
      nodes {
        shopId
        shopName
        commissionRate
        sellerCommCoveRatio
        imageUrl
        offerLink
        originalLink
        ratingStar
        periodStartTime
        periodEndTime
        remainingBudget
      }
      pageInfo { page limit hasNextPage scrollId }
    }
  }
`;

export type AffiliateProductNode = {
  itemId: string | number;
  productName: string;
  commissionRate: number;
  commission: number;
  sales: number;
  priceMin: number;
  priceMax: number;
  priceDiscountRate: number;
  imageUrl: string;
  productLink: string;
  offerLink: string;
  periodStartTime: number;
  periodEndTime: number;
  shopId: string | number;
  shopName: string;
  shopType: number[];
  productCatIds: number[];
  ratingStar: number | null;
};

export type AffiliateShopNode = {
  shopId: string | number;
  shopName: string;
  commissionRate: number;
  sellerCommCoveRatio: number;
  imageUrl: string;
  offerLink: string;
  originalLink: string;
  ratingStar: number;
  periodStartTime: number;
  periodEndTime: number;
  remainingBudget: number;
};
