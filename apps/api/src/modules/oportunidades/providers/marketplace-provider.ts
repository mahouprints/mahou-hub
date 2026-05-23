import type { OportunidadeMarketplace } from '@mahou-hub/contracts';

// Candidato que cada provider devolve. Forma estável independente do marketplace
// (Shopee, TikTok, ML etc.) — o service materializa isso em ProdutoOportunidade.
export type OportunidadeCandidato = {
  marketplace: OportunidadeMarketplace;
  externalId: string;
  productName: string;
  priceMinCentavos: number;
  priceMaxCentavos: number;
  imageUrl: string;
  productLink: string;
  vendasAfiliadoMes: number;
  ratingStar: number | null;
  categoriaIds: number[];
  lojaExternalId: string | null;
  lojaNome: string | null;
  // Origem opcional pra correlacionar com snapshot existente (Shopee preenche quando aplica).
  snapshotProdutoId?: string;
  concorrenteId?: string;
};

export type SearchOpts = {
  precoMinCentavos?: number;
  precoMaxCentavos?: number;
  vendasMin?: number;
  ratingMin?: number;
  limit?: number;
};

export interface MarketplaceProvider {
  readonly marketplace: OportunidadeMarketplace;
  searchByKeyword(keyword: string, opts: SearchOpts): Promise<OportunidadeCandidato[]>;
  searchByCategory(categoryId: string, opts: SearchOpts): Promise<OportunidadeCandidato[]>;
  // Top global (modo brainstorm). Sem filtro de nicho.
  exploreTopVendas(opts: SearchOpts): Promise<OportunidadeCandidato[]>;
  // Produtos de concorrentes já monitorados (Shopee lê snapshots; outros podem implementar diferente).
  listFromMonitored(
    opts: SearchOpts & { concorrenteId?: string },
  ): Promise<OportunidadeCandidato[]>;
  // Investigação ad-hoc de loja externa não cadastrada — chama Affiliate API on-demand.
  // Opcional: providers sem essa capacidade podem omitir (caller faz fallback).
  listByShopIdLive?(shopId: string, opts: SearchOpts): Promise<OportunidadeCandidato[]>;
}

// DI token usado pra registrar providers via multi-inject.
export const MARKETPLACE_PROVIDERS = Symbol('MARKETPLACE_PROVIDERS');
