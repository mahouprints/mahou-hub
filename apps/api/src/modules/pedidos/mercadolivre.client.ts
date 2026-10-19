import { Injectable } from '@nestjs/common';
import { MercadoLivreHttpService } from '../mercado-livre/mercado-livre-http.service';
import {
  MercadoLivreCustosService,
  type CacheEnviosMl,
} from '../mercado-livre/mercado-livre-custos.service';
import type { ItemImportado, PedidoImportado } from './atendimento.service';

interface MlOrderItem {
  item?: {
    id?: string;
    title?: string;
    seller_sku?: string;
    seller_custom_field?: string;
    variation_id?: number | null;
  };
  quantity?: number;
  unit_price?: number;
  sale_fee?: number | null;
}

interface MlOrder {
  id: number | string;
  status: string;
  date_created?: string;
  total_amount?: number;
  buyer?: { nickname?: string };
  order_items?: MlOrderItem[];
}

@Injectable()
export class MercadoLivreClient {
  constructor(
    private readonly http: MercadoLivreHttpService,
    private readonly custos: MercadoLivreCustosService,
  ) {}

  /** Verifica a integração antes de sincronizar. Ex.: estaConfigurado(). */
  estaConfigurado(): boolean {
    return this.http.estaConfigurado();
  }

  /** Consulta pedido e custos reais. Ex.: buscarPedido('200001234'). */
  async buscarPedido(orderId: string, cache: CacheEnviosMl = new Map()): Promise<PedidoImportado> {
    const pedido = await this.http.get<MlOrder>(`/orders/${encodeURIComponent(orderId)}`);
    const linhas = pedido.order_items ?? [];
    const fretes = await this.custos.fretePorItens(
      String(pedido.id),
      linhas.map((linha) => ({
        itemId: linha.item?.id ?? '',
        variacaoId: String(linha.item?.variation_id ?? ''),
        qtd: linha.quantity ?? 1,
      })),
      cache,
    );
    return this.normalizar(pedido, fretes);
  }

  /** Rede de segurança para webhook perdido. Ex.: listarPedidosPagos(inicioDoDia). */
  async listarPedidosPagos(desde: Date): Promise<PedidoImportado[]> {
    const query = new URLSearchParams({
      seller: this.http.sellerId,
      'order.status': 'paid',
      'order.date_created.from': desde.toISOString(),
      sort: 'date_desc',
      limit: '50',
    });
    const resposta = await this.http.get<{ results?: { id: number | string }[] }>(
      `/orders/search?${query}`,
    );
    const pedidos: PedidoImportado[] = [];
    const cache: CacheEnviosMl = new Map();
    for (const pedido of resposta.results ?? [])
      pedidos.push(await this.buscarPedido(String(pedido.id), cache));
    return pedidos;
  }

  private normalizar(pedido: MlOrder, fretes: (number | null)[]): PedidoImportado {
    const custosMlAtualizadosEm = new Date();
    const itens: ItemImportado[] = (pedido.order_items ?? []).map((linha, indice) => ({
      // Anúncios antigos usam seller_custom_field; item.id mantém rastreio sem SKU.
      skuExterno: linha.item?.seller_sku || linha.item?.seller_custom_field || linha.item?.id || '',
      nomeExterno: linha.item?.title ?? '',
      qtd: linha.quantity ?? 1,
      precoUnitarioCentavos: Math.round((linha.unit_price ?? 0) * 100),
      mlItemId: linha.item?.id ?? null,
      // sale_fee é unitária; frete já representa o total rateado da linha.
      tarifaMlCentavos:
        typeof linha.sale_fee === 'number' && Number.isFinite(linha.sale_fee) && linha.sale_fee >= 0
          ? Math.round(linha.sale_fee * (linha.quantity ?? 1) * 100)
          : null,
      freteMlCentavos: fretes[indice] ?? null,
      custosMlAtualizadosEm,
    }));
    return {
      canal: 'ML',
      externalId: String(pedido.id),
      statusExterno: pedido.status,
      compradorNome: pedido.buyer?.nickname ?? null,
      totalCentavos: Math.round((pedido.total_amount ?? 0) * 100),
      prazoEnvio: null,
      dataPedido: pedido.date_created ? new Date(pedido.date_created) : new Date(),
      itens,
    };
  }
}
