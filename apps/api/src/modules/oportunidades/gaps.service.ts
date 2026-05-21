import { Injectable } from '@nestjs/common';
import type {
  CategoriaEmergente,
  GapClassificacao,
  GapItem,
  GapsQuery,
  OportunidadeMarketplace,
} from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { estimarVendasTotaisMes } from '@mahou-hub/pricing';
import { CATEGORIAS_SHOPEE_3D_MAP } from './providers/shopee-categorias-3d';

/// Tokens descartados ao normalizar nomes pra match — palavras genéricas que não diferenciam produto.
const STOP_WORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'para', 'pra', 'com', 'sem', 'em', 'no', 'na', 'nos', 'nas',
  'kit', 'set', 'jogo', 'par', 'um', 'uma', 'novo', 'novos', 'pcs', 'unidades', 'pç', 'pç.',
  'top', 'premium', 'luxo', 'original', 'modelo', 'tamanho', 'cm', 'mm', 'cores', 'cor',
  '3d', 'impressão', 'impressao', 'plástico', 'plastico', 'pla', 'petg', 'abs',
]);

@Injectable()
export class GapsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Lista produtos do snapshot agregado dos concorrentes, classificados vs catálogo Mahou.
  /// Algoritmo de match é qualitativo (token-jaccard + faixa de preço); decisões manuais (MATCH_MANUAL/DESCARTADO)
  /// têm prioridade absoluta sobre a classificação automática.
  async listar(query: GapsQuery): Promise<{ items: GapItem[]; total: number }> {
    const [snapshots, produtosMahou, decisoes] = await Promise.all([
      this.snapshotsAgregados(query.lojaExternalId),
      this.prisma.produto.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, precoCentavos: true },
      }),
      this.prisma.produtoGapDecisao.findMany({
        select: { marketplace: true, externalId: true, decisao: true, produtoId: true, observacao: true, decididoPor: true, decididoEm: true },
      }),
    ]);

    const decisaoMap = new Map(
      decisoes.map((d) => [`${d.marketplace}|${d.externalId}`, d]),
    );
    const mahouIndex = produtosMahou.map((p) => ({
      ...p,
      tokens: this.tokens(p.nome),
    }));
    const mahouById = new Map(produtosMahou.map((p) => [p.id, p]));

    const items: GapItem[] = snapshots.map((snap) => {
      const decisao = decisaoMap.get(`${snap.marketplace}|${snap.externalId}`);
      let classificacao: GapClassificacao;
      let produtoMahouSimilar: GapItem['produtoMahouSimilar'] = null;

      if (decisao) {
        classificacao = decisao.decisao;
        const matchProd = decisao.produtoId ? mahouById.get(decisao.produtoId) : undefined;
        if (matchProd) produtoMahouSimilar = { id: matchProd.id, nome: matchProd.nome };
      } else {
        const auto = this.classificarAuto(snap, mahouIndex);
        classificacao = auto.classificacao;
        produtoMahouSimilar = auto.produtoMahouSimilar;
      }

      return {
        marketplace: snap.marketplace,
        externalId: snap.externalId,
        productName: snap.productName,
        priceMinCentavos: snap.priceMinCentavos,
        priceMaxCentavos: snap.priceMaxCentavos,
        imageUrl: snap.imageUrl,
        productLink: snap.productLink,
        vendasEstimadasMes: snap.vendasEstimadasMes,
        ratingStar: snap.ratingStar,
        categoriaIds: snap.categoriaIds,
        lojaExternalId: snap.lojaExternalId,
        lojaNome: snap.lojaNome,
        classificacao,
        produtoMahouSimilar,
        decisao: decisao
          ? {
              tipo: decisao.decisao,
              observacao: decisao.observacao,
              decididoPor: decisao.decididoPor,
              decididoEm: decisao.decididoEm.toISOString(),
            }
          : null,
      };
    });

    const filtered = items.filter((item) => {
      if (query.classificacao && item.classificacao !== query.classificacao) return false;
      if (query.categoriaId != null && !item.categoriaIds.includes(query.categoriaId)) return false;
      if (query.vendasMin != null && item.vendasEstimadasMes < query.vendasMin) return false;
      if (query.q) {
        const needle = query.q.toLowerCase();
        if (!item.productName.toLowerCase().includes(needle)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => b.vendasEstimadasMes - a.vendasEstimadasMes);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
    };
  }

  /// Identifica categorias Shopee frequentes nos GAPs detectados que NÃO estão na lista curada
  /// `CATEGORIAS_SHOPEE_3D`. Útil pra expandir o curador manual.
  async categoriasEmergentes(minFreq = 3): Promise<CategoriaEmergente[]> {
    const { items } = await this.listar({ classificacao: 'GAP', pageSize: 500 });
    const freqs = new Map<number, { freq: number; exemplos: string[] }>();
    for (const item of items) {
      for (const catId of item.categoriaIds) {
        if (catId === 0 || CATEGORIAS_SHOPEE_3D_MAP.has(catId)) continue;
        const entry = freqs.get(catId) ?? { freq: 0, exemplos: [] };
        entry.freq += 1;
        if (entry.exemplos.length < 3) entry.exemplos.push(item.productName);
        freqs.set(catId, entry);
      }
    }
    return [...freqs.entries()]
      .filter(([, v]) => v.freq >= minFreq)
      .map(([categoriaId, v]) => ({ categoriaId, ...v }))
      .sort((a, b) => b.freq - a.freq);
  }

  /// Lê snapshots mais recentes dos concorrentes cadastrados.
  /// Filtragem opcional por lojaExternalId (Shopee shopId).
  private async snapshotsAgregados(
    lojaExternalId?: string,
  ): Promise<
    {
      marketplace: OportunidadeMarketplace;
      externalId: string;
      productName: string;
      priceMinCentavos: number;
      priceMaxCentavos: number;
      imageUrl: string;
      productLink: string;
      vendasEstimadasMes: number;
      ratingStar: number | null;
      categoriaIds: number[];
      lojaExternalId: string | null;
      lojaNome: string | null;
    }[]
  > {
    const whereLoja = lojaExternalId
      ? { shopId: BigInt(lojaExternalId) }
      : { shopId: { not: null } };
    const lojas = await this.prisma.concorrente.findMany({
      where: whereLoja,
      select: {
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
    const out: Awaited<ReturnType<GapsService['snapshotsAgregados']>> = [];
    for (const loja of lojas) {
      const snap = loja.snapshots[0];
      if (!snap) continue;
      for (const p of snap.produtos) {
        out.push({
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
        });
      }
    }
    return out;
  }

  /// Match qualitativo: jaccard de tokens (>=0.5 → MATCH, 0.3-0.5 + preço próximo → VARIACAO, senão GAP).
  /// Limiares baseados em observação manual — calibrar se gerar muitos falsos positivos/negativos.
  private classificarAuto(
    snap: {
      productName: string;
      priceMinCentavos: number;
      categoriaIds: number[];
    },
    mahouIndex: { id: string; nome: string; precoCentavos: number; tokens: Set<string> }[],
  ): {
    classificacao: 'GAP' | 'VARIACAO' | 'MATCH';
    produtoMahouSimilar: GapItem['produtoMahouSimilar'];
  } {
    const concorrenteTokens = this.tokens(snap.productName);
    if (concorrenteTokens.size === 0) return { classificacao: 'GAP', produtoMahouSimilar: null };

    let best: { produto: (typeof mahouIndex)[number]; jaccard: number } | null = null;
    for (const p of mahouIndex) {
      if (p.tokens.size === 0) continue;
      const intersection = [...concorrenteTokens].filter((t) => p.tokens.has(t)).length;
      const union = new Set([...concorrenteTokens, ...p.tokens]).size;
      const jaccard = intersection / union;
      if (!best || jaccard > best.jaccard) {
        best = { produto: p, jaccard };
      }
    }
    if (!best) return { classificacao: 'GAP', produtoMahouSimilar: null };

    const precoMahou = best.produto.precoCentavos;
    const precoProximo = Math.abs(precoMahou - snap.priceMinCentavos) / Math.max(precoMahou, 1) < 0.5;

    if (best.jaccard >= 0.5) {
      return {
        classificacao: 'MATCH',
        produtoMahouSimilar: { id: best.produto.id, nome: best.produto.nome },
      };
    }
    if (best.jaccard >= 0.3 && precoProximo) {
      return {
        classificacao: 'VARIACAO',
        produtoMahouSimilar: { id: best.produto.id, nome: best.produto.nome },
      };
    }
    return { classificacao: 'GAP', produtoMahouSimilar: null };
  }

  /// Tokeniza nome removendo stop-words e palavras curtas. Usado pelo jaccard.
  private tokens(nome: string): Set<string> {
    return new Set(
      nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !STOP_WORDS.has(t)),
    );
  }
}
