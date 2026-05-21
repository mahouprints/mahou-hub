import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OportunidadeMarketplace } from '@mahou-hub/contracts';
import {
  MARKETPLACE_PROVIDERS,
  type MarketplaceProvider,
  type OportunidadeCandidato,
  type SearchOpts,
} from './providers/marketplace-provider';

type BuscarParams =
  | { tipo: 'keyword'; params: { keyword: string } }
  | { tipo: 'categoria'; params: { categoryId: string } }
  | { tipo: 'concorrente'; params: { concorrenteId?: string; lojaExternalId?: string } };

@Injectable()
export class DescobertaService {
  private readonly byMarketplace: Map<OportunidadeMarketplace, MarketplaceProvider>;

  constructor(
    @Inject(MARKETPLACE_PROVIDERS) providers: MarketplaceProvider[],
  ) {
    this.byMarketplace = new Map(providers.map((p) => [p.marketplace, p]));
  }

  async buscar(
    marketplace: OportunidadeMarketplace,
    spec: BuscarParams,
    filtros: SearchOpts,
  ): Promise<OportunidadeCandidato[]> {
    const provider = this.providerFor(marketplace);
    switch (spec.tipo) {
      case 'keyword':
        return provider.searchByKeyword(spec.params.keyword, filtros);
      case 'categoria':
        return provider.searchByCategory(spec.params.categoryId, filtros);
      case 'concorrente': {
        // lojaExternalId tem prioridade: investigação ad-hoc on-demand (Affiliate API live).
        if (spec.params.lojaExternalId) {
          if (!provider.listByShopIdLive) {
            throw new BadRequestException(
              `Marketplace ${marketplace} não suporta busca live por lojaExternalId.`,
            );
          }
          return provider.listByShopIdLive(spec.params.lojaExternalId, filtros);
        }
        return provider.listFromMonitored({
          ...filtros,
          concorrenteId: spec.params.concorrenteId,
        });
      }
    }
  }

  async explorar(
    marketplace: OportunidadeMarketplace,
    filtros: SearchOpts,
  ): Promise<OportunidadeCandidato[]> {
    return this.providerFor(marketplace).exploreTopVendas(filtros);
  }

  private providerFor(marketplace: OportunidadeMarketplace): MarketplaceProvider {
    const p = this.byMarketplace.get(marketplace);
    if (!p) {
      throw new NotFoundException(
        `Marketplace ${marketplace} ainda não tem provider implementado. ` +
          `Disponíveis: ${[...this.byMarketplace.keys()].join(', ') || 'nenhum'}`,
      );
    }
    return p;
  }
}
