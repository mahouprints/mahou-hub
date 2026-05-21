import { Injectable } from '@nestjs/common';
import { estimarVendasTotaisMes } from '@mahou-hub/pricing';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShopeeAffiliateService } from '../../concorrentes/shopee-affiliate.service';
import type { AffiliateProductNode } from '../../concorrentes/shopee/queries';
import {
  type MarketplaceProvider,
  type OportunidadeCandidato,
  type SearchOpts,
} from './marketplace-provider';

@Injectable()
export class ShopeeProvider implements MarketplaceProvider {
  readonly marketplace = 'SHOPEE' as const;

  constructor(
    private readonly shopee: ShopeeAffiliateService,
    private readonly prisma: PrismaService,
  ) {}

  async searchByKeyword(keyword: string, opts: SearchOpts): Promise<OportunidadeCandidato[]> {
    const nodes = await this.shopee.searchByKeyword(keyword, {
      limit: opts.limit ?? 200,
      filter: this.makeNodeFilter(opts),
    });
    return nodes.map((n) => this.materializeNode(n));
  }

  async searchByCategory(categoryId: string, opts: SearchOpts): Promise<OportunidadeCandidato[]> {
    const catId = Number(categoryId);
    if (!Number.isFinite(catId)) {
      throw new Error(`categoryId Shopee precisa ser numérico, recebido "${categoryId}"`);
    }
    const nodes = await this.shopee.searchByCategory(catId, {
      limit: opts.limit ?? 200,
      filter: this.makeNodeFilter(opts),
    });
    return nodes.map((n) => this.materializeNode(n));
  }

  async exploreTopVendas(opts: SearchOpts): Promise<OportunidadeCandidato[]> {
    const nodes = await this.shopee.fetchTopOffers({
      limit: opts.limit ?? 200,
      filter: this.makeNodeFilter(opts),
    });
    return nodes.map((n) => this.materializeNode(n));
  }

  // Lê produtos dos snapshots mais recentes das lojas monitoradas. Sem custo extra de API.
  async listFromMonitored(
    opts: SearchOpts & { concorrenteId?: string },
  ): Promise<OportunidadeCandidato[]> {
    const whereLoja = opts.concorrenteId ? { id: opts.concorrenteId } : { shopId: { not: null } };
    const lojas = await this.prisma.concorrente.findMany({
      where: whereLoja,
      select: {
        id: true,
        loja: true,
        shopId: true,
        snapshots: {
          orderBy: { sincronizadoEm: 'desc' },
          take: 1,
          where: { erroMensagem: null },
          include: { produtos: true },
        },
      },
    });
    const candidatos: OportunidadeCandidato[] = [];
    for (const loja of lojas) {
      const snap = loja.snapshots[0];
      if (!snap) continue;
      for (const p of snap.produtos) {
        candidatos.push({
          marketplace: 'SHOPEE',
          externalId: p.itemId.toString(),
          productName: p.productName,
          priceMinCentavos: p.priceMinCentavos,
          priceMaxCentavos: p.priceMaxCentavos,
          imageUrl: p.imageUrl,
          productLink: p.productLink,
          vendasEstimadasMes: estimarVendasTotaisMes({
            sales: p.sales,
            periodStartTime: p.periodStartTime,
            periodEndTime: p.periodEndTime,
          }),
          ratingStar: p.ratingStar != null ? Number(p.ratingStar) : null,
          categoriaIds: p.productCatIds,
          lojaExternalId: loja.shopId?.toString() ?? null,
          lojaNome: loja.loja,
          snapshotProdutoId: p.id,
          concorrenteId: loja.id,
        });
      }
    }
    return this.applyFiltersToMaterialized(candidatos, opts).slice(0, opts.limit ?? 200);
  }

  // Materializa AffiliateProductNode → OportunidadeCandidato (sem filtrar — filter foi
  // aplicado durante a paginação pra cortar cedo e respeitar `limit` pós-filtro).
  private materializeNode(p: AffiliateProductNode): OportunidadeCandidato {
    return {
      marketplace: 'SHOPEE',
      externalId: p.itemId.toString(),
      productName: p.productName,
      priceMinCentavos: Math.round(Number(p.priceMin) * 100),
      priceMaxCentavos: Math.round(Number(p.priceMax) * 100),
      imageUrl: p.imageUrl,
      productLink: p.productLink,
      vendasEstimadasMes: estimarVendasTotaisMes({
        sales: Math.trunc(Number(p.sales ?? 0)),
        periodStartTime: new Date(Number(p.periodStartTime) * 1000),
        periodEndTime: new Date(Number(p.periodEndTime) * 1000),
      }),
      ratingStar: p.ratingStar != null ? Number(p.ratingStar) : null,
      categoriaIds: (p.productCatIds ?? []).map((n) => Math.trunc(Number(n))),
      lojaExternalId: p.shopId != null ? String(p.shopId) : null,
      lojaNome: p.shopName ?? null,
    };
  }

  // Constrói filter (node → bool) que paginate vai aplicar página a página.
  // Filtros operam no node BRUTO; vendas mínimas precisa do cálculo de heurística.
  // Exportado como método pra ser testável isoladamente.
  makeNodeFilter(opts: SearchOpts): (n: AffiliateProductNode) => boolean {
    return (n) => {
      const priceMinCents = Math.round(Number(n.priceMin) * 100);
      if (opts.precoMinCentavos != null && priceMinCents < opts.precoMinCentavos) return false;
      if (opts.precoMaxCentavos != null && priceMinCents > opts.precoMaxCentavos) return false;
      if (opts.ratingMin != null && Number(n.ratingStar ?? 0) < opts.ratingMin) return false;
      if (opts.vendasMin != null) {
        const vendasMes = estimarVendasTotaisMes({
          sales: Math.trunc(Number(n.sales ?? 0)),
          periodStartTime: new Date(Number(n.periodStartTime) * 1000),
          periodEndTime: new Date(Number(n.periodEndTime) * 1000),
        });
        if (vendasMes < opts.vendasMin) return false;
      }
      return true;
    };
  }

  // Filtro pós-fato pra listFromMonitored (que vem do banco, não da Affiliate API).
  // Aplica mesma semântica de makeNodeFilter mas em OportunidadeCandidato.
  applyFiltersToMaterialized(
    items: OportunidadeCandidato[],
    opts: SearchOpts,
  ): OportunidadeCandidato[] {
    return items.filter((c) => {
      if (opts.precoMinCentavos != null && c.priceMinCentavos < opts.precoMinCentavos) return false;
      if (opts.precoMaxCentavos != null && c.priceMinCentavos > opts.precoMaxCentavos) return false;
      if (opts.vendasMin != null && c.vendasEstimadasMes < opts.vendasMin) return false;
      if (opts.ratingMin != null && (c.ratingStar ?? 0) < opts.ratingMin) return false;
      return true;
    });
  }
}
