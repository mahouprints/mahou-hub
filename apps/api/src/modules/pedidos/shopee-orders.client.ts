import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { ItemImportado, PedidoImportado } from './atendimento.service';
import { SHOPEE_STATUS_A_SINCRONIZAR } from './status-marketplace';

// Cliente da Shopee OPEN PLATFORM (API de vendedor) — não confundir com o cliente da
// Affiliate API em `modules/concorrentes/shopee`, que serve pra espiar concorrente e usa
// autenticação e host completamente diferentes.
//
// Assinatura v2: HMAC-SHA256 sobre `partner_id + path + timestamp + access_token + shop_id`,
// com a partner_key como segredo. A base string NÃO inclui o corpo da requisição — detalhe
// que difere da Affiliate API e é a causa clássica de "sign mismatch".

const HOST_PRODUCAO = 'https://partner.shopeemobile.com';

interface ShopeeOrderItem {
  model_sku?: string;
  item_sku?: string;
  item_name?: string;
  model_quantity_purchased?: number;
  model_discounted_price?: number;
}

interface ShopeeOrderDetail {
  order_sn: string;
  order_status: string;
  buyer_username?: string;
  total_amount?: number;
  create_time?: number;
  ship_by_date?: number;
  item_list?: ShopeeOrderItem[];
}

@Injectable()
export class ShopeeOrdersClient {
  private readonly logger = new Logger(ShopeeOrdersClient.name);

  constructor(private readonly config: ConfigService) {}

  private get credenciais() {
    return {
      partnerId: Number(this.config.get<string>('SHOPEE_PARTNER_ID') ?? 0),
      partnerKey: this.config.get<string>('SHOPEE_PARTNER_KEY') ?? '',
      shopId: Number(this.config.get<string>('SHOPEE_SHOP_ID') ?? 0),
      accessToken: this.config.get<string>('SHOPEE_ACCESS_TOKEN') ?? '',
      host: this.config.get<string>('SHOPEE_API_HOST') ?? HOST_PRODUCAO,
    };
  }

  estaConfigurado(): boolean {
    const c = this.credenciais;
    return Boolean(c.partnerId && c.partnerKey && c.shopId && c.accessToken);
  }

  /**
   * Monta a URL assinada de um endpoint autenticado da Open Platform.
   * Exposto pra teste porque a assinatura é o ponto mais fácil de errar em silêncio —
   * credencial errada devolve `error: "error_sign"`, não uma exceção de rede.
   */
  construirUrlAssinada(path: string, params: Record<string, string> = {}): string {
    const { partnerId, partnerKey, shopId, accessToken, host } = this.credenciais;
    const timestamp = Math.floor(Date.now() / 1000);
    const base = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    const sign = createHmac('sha256', partnerKey).update(base).digest('hex');

    const query = new URLSearchParams({
      partner_id: String(partnerId),
      timestamp: String(timestamp),
      access_token: accessToken,
      shop_id: String(shopId),
      sign,
      ...params,
    });
    return `${host}${path}?${query}`;
  }

  private async chamar<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const resposta = await fetch(this.construirUrlAssinada(path, params));
    const json = (await resposta.json()) as { error?: string; message?: string; response?: T };

    // A Shopee devolve HTTP 200 com `error` preenchido no corpo — checar só o status
    // deixaria erro de credencial passar como sucesso.
    if (json.error) {
      throw new Error(`Shopee ${path}: ${json.error} — ${json.message ?? 'sem mensagem'}`);
    }
    return json.response as T;
  }

  /**
   * `order_sn` dos pedidos da janela, varrendo todos os status que interessam.
   *
   * Uma chamada por status porque `get_order_list` aceita só um `order_status` por vez.
   * Trazer os despachados junto com os pendentes é o que permite o Hub perceber que um
   * pedido saiu — sem isso ele nunca seria reimportado e ficaria congelado como atendido.
   */
  async listarPedidos(desde: Date, ate: Date): Promise<string[]> {
    const sns = new Set<string>();

    for (const status of SHOPEE_STATUS_A_SINCRONIZAR) {
      const resposta = await this.chamar<{ order_list?: Array<{ order_sn: string }> }>(
        '/api/v2/order/get_order_list',
        {
          time_range_field: 'create_time',
          time_from: String(Math.floor(desde.getTime() / 1000)),
          time_to: String(Math.floor(ate.getTime() / 1000)),
          page_size: '50',
          order_status: status,
        },
      );
      for (const o of resposta.order_list ?? []) sns.add(o.order_sn);
    }
    return [...sns];
  }

  /** Detalhe de até 50 pedidos por chamada (limite da API). */
  async detalharPedidos(orderSns: string[]): Promise<PedidoImportado[]> {
    if (orderSns.length === 0) return [];

    const resposta = await this.chamar<{ order_list?: ShopeeOrderDetail[] }>(
      '/api/v2/order/get_order_detail',
      {
        order_sn_list: orderSns.slice(0, 50).join(','),
        response_optional_fields: 'buyer_username,item_list,total_amount,ship_by_date',
      },
    );
    return (resposta.order_list ?? []).map((o) => this.normalizar(o));
  }

  /**
   * Traduz o pedido da Shopee pro formato interno.
   *
   * Valores vêm em REAIS com decimal (`total_amount: 74.9`), não em centavos —
   * multiplicar e arredondar aqui evita que o erro de escala vaze pro resto do Hub.
   * Timestamps são epoch em SEGUNDOS.
   */
  private normalizar(o: ShopeeOrderDetail): PedidoImportado {
    const itens: ItemImportado[] = (o.item_list ?? []).map((i) => ({
      // model_sku é o SKU da variação; item_sku é o do produto pai. A variação é o que
      // casa com ProdutoVariacao.sku, então ela vem primeiro.
      skuExterno: i.model_sku || i.item_sku || '',
      nomeExterno: i.item_name ?? '',
      qtd: i.model_quantity_purchased ?? 1,
      precoUnitarioCentavos: Math.round((i.model_discounted_price ?? 0) * 100),
    }));

    return {
      canal: 'SHOPEE',
      externalId: o.order_sn,
      statusExterno: o.order_status,
      compradorNome: o.buyer_username ?? null,
      totalCentavos: Math.round((o.total_amount ?? 0) * 100),
      prazoEnvio: o.ship_by_date ? new Date(o.ship_by_date * 1000) : null,
      dataPedido: o.create_time ? new Date(o.create_time * 1000) : new Date(),
      itens,
    };
  }
}
