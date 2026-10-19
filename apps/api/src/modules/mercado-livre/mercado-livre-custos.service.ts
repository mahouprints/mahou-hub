import { Injectable } from '@nestjs/common';
import { MercadoLivreHttpService } from './mercado-livre-http.service';

export interface ItemEnvioMl {
  itemId: string;
  variacaoId: string;
  qtd: number;
}
interface ItemShipmentMl {
  order_id: number | string;
  sender_id: number | string;
  item_id: string;
  variation_id?: number | string | null;
  quantity: number;
}
interface CustoShipmentMl {
  senders?: { user_id: number | string; cost: number }[];
}
type ParcelaFrete = { centavos: number; qtd: number };
export type CacheEnviosMl = Map<string, Promise<Map<string, ParcelaFrete>>>;

function chaveLinha(orderId: string, itemId: string, variacaoId: string): string {
  return `${orderId}:${itemId}:${variacaoId}`;
}

@Injectable()
export class MercadoLivreCustosService {
  constructor(private readonly http: MercadoLivreHttpService) {}

  /** Rateia cada envio uma vez entre seus itens. Ex.: fretePorItens('123', itens). */
  async fretePorItens(
    orderId: string,
    itens: ItemEnvioMl[],
    cache: CacheEnviosMl = new Map(),
  ): Promise<(number | null)[]> {
    const pendente = itens.map(() => null);
    const chaves = itens.map((item) => chaveLinha(orderId, item.itemId, item.variacaoId));
    if (new Set(chaves).size !== chaves.length) return pendente;
    try {
      const parcelas = await this.parcelasDoPedido(orderId, cache);
      return itens.map((item, indice) => {
        const parcela = parcelas.get(chaves[indice]!);
        return parcela?.qtd === item.qtd ? parcela.centavos : null;
      });
    } catch {
      // Falha/propagação não significa frete grátis. Preserva pendência para nova sincronização.
      return pendente;
    }
  }

  private async parcelasDoPedido(orderId: string, cache: CacheEnviosMl) {
    const vinculos = await this.http.get<{ id: number | string; type: string }[]>(
      `/orders/${encodeURIComponent(orderId)}/shipments?hosted=true`,
      { 'X-New-Domain': 'true' },
    );
    const ids = [
      ...new Set(
        vinculos.filter((envio) => envio.type === 'forward').map((envio) => String(envio.id)),
      ),
    ];
    if (!ids.length) throw new Error('Envio ainda não disponível.');
    const parcelas = new Map<string, ParcelaFrete>();
    for (const id of ids) {
      if (!cache.has(id)) cache.set(id, this.parcelasDoEnvio(id));
      const envio = await cache.get(id)!;
      for (const [chave, parcela] of envio) {
        const anterior = parcelas.get(chave) ?? { centavos: 0, qtd: 0 };
        parcelas.set(chave, {
          centavos: anterior.centavos + parcela.centavos,
          qtd: anterior.qtd + parcela.qtd,
        });
      }
    }
    return parcelas;
  }

  private async parcelasDoEnvio(id: string): Promise<Map<string, ParcelaFrete>> {
    const headers = { 'x-format-new': 'true' };
    const [custos, itens] = await Promise.all([
      this.http.get<CustoShipmentMl>(`/shipments/${id}/costs`, headers),
      this.http.get<ItemShipmentMl[]>(`/shipments/${id}/items`, headers),
    ]);
    const remetentes =
      custos.senders?.filter((remetente) => String(remetente.user_id) === this.http.sellerId) ?? [];
    const custo = remetentes[0]?.cost;
    if (
      remetentes.length !== 1 ||
      typeof custo !== 'number' ||
      !Number.isFinite(custo) ||
      custo < 0
    ) {
      throw new Error('Custo do vendedor indisponível.');
    }
    return this.ratearPorQuantidade(Math.round(custo * 100), itens);
  }

  private ratearPorQuantidade(total: number, itens: ItemShipmentMl[]) {
    if (itens.some((item) => item.sender_id === undefined || item.sender_id === null))
      throw new Error('Remetente não identificado.');
    const parcelas = new Map<string, ParcelaFrete>();
    for (const item of itens.filter((linha) => String(linha.sender_id) === this.http.sellerId)) {
      if (!item.order_id || !item.item_id || !Number.isInteger(item.quantity) || item.quantity <= 0)
        throw new Error('Item de envio incompleto.');
      const chave = chaveLinha(
        String(item.order_id),
        item.item_id,
        String(item.variation_id ?? ''),
      );
      parcelas.set(chave, { centavos: 0, qtd: (parcelas.get(chave)?.qtd ?? 0) + item.quantity });
    }
    const linhas = [...parcelas.entries()].sort(([a], [b]) => a.localeCompare(b));
    const quantidade = linhas.reduce((soma, [, linha]) => soma + linha.qtd, 0);
    if (!quantidade) throw new Error('Nenhum item do vendedor no envio.');
    // Rateio interno por quantidade; a API entrega custo por vendedor/envio, não por item.
    const base = linhas.map(([chave, linha]): [string, ParcelaFrete] => [
      chave,
      { qtd: linha.qtd, centavos: Math.floor((total * linha.qtd) / quantidade) },
    ]);
    const resto = total - base.reduce((soma, [, linha]) => soma + linha.centavos, 0);
    base.forEach(([, linha], indice) => {
      if (indice < resto) linha.centavos += 1;
    });
    return new Map(base);
  }
}
