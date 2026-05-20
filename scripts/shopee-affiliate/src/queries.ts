// Queries GraphQL da Shopee Affiliate.
// Endpoint v2: open-api.affiliate.shopee.com.br/graphql.
// Como a introspection está desabilitada, descobrimos os campos por tentativa+erro — as queries abaixo
// foram refinadas a partir dos erros do servidor.

// Campos mínimos confirmados em ProductOfferV2:
//   itemId, productName, commissionRate, priceMin, priceMax, sales, imageUrl,
//   productLink, offerLink, shopId, shopName, productCatIds, ratingStar,
//   priceDiscountRate, commission, periodStartTime, periodEndTime.
// (campos *BeforeDiscount não existem; arg categoria chama-se `productCatId` no singular.)

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
  productCatIds
  ratingStar
`;

export const PRODUCT_OFFER_TOP = /* GraphQL */ `
  query ProdutosTop($limit: Int, $page: Int, $sortType: Int) {
    productOfferV2(limit: $limit, page: $page, sortType: $sortType) {
      nodes { ${PRODUCT_NODE_FIELDS} }
      pageInfo { page limit hasNextPage scrollId }
    }
  }
`;

export const PRODUCT_OFFER_BY_CATEGORY = /* GraphQL */ `
  query ProdutosPorCategoria($productCatId: Int, $limit: Int, $page: Int, $sortType: Int) {
    productOfferV2(productCatId: $productCatId, limit: $limit, page: $page, sortType: $sortType) {
      nodes { ${PRODUCT_NODE_FIELDS} }
      pageInfo { page limit hasNextPage scrollId }
    }
  }
`;

export const PRODUCT_OFFER_BY_KEYWORD = /* GraphQL */ `
  query ProdutosPorKeyword($keyword: String, $limit: Int, $page: Int, $sortType: Int) {
    productOfferV2(keyword: $keyword, limit: $limit, page: $page, sortType: $sortType) {
      nodes { ${PRODUCT_NODE_FIELDS} }
      pageInfo { page limit hasNextPage scrollId }
    }
  }
`;

// shopId é Int64 no schema da Shopee (descoberto via erro "Variable used in position expecting type Int64").
export const PRODUCT_OFFER_BY_SHOP = /* GraphQL */ `
  query ProdutosPorLoja($shopId: Int64, $limit: Int, $page: Int, $sortType: Int) {
    productOfferV2(shopId: $shopId, limit: $limit, page: $page, sortType: $sortType) {
      nodes { ${PRODUCT_NODE_FIELDS} }
      pageInfo { page limit hasNextPage scrollId }
    }
  }
`;

// Campos de ShopOfferV2 (descobertos por tentativa): commissionRate, sellerCommCoveRatio (em vez de sellerCommissionRate).
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
