import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ItemImportado, PedidoImportado } from './atendimento.service';

// Cliente da API do Mercado Livre. Diferente da Shopee em dois pontos que mudam o desenho:
//
// 1. Autenticação é OAuth2 com access_token de vida CURTA (~6h) e refresh_token. O token
//    guardado na env expira sozinho, então toda chamada passa por `tokenValido()`.
// 2. O ML entrega pedido por WEBHOOK (`orders_v2`), não por polling. O polling aqui é
//    rede de segurança pra janela em que o webhook falhou — não o caminho principal.

const API = 'https://api.mercadolibre.com';

interface MlOrderItem {
  item?: { id?: string; title?: string; seller_sku?: string; seller_custom_field?: string };
  quantity?: number;
  unit_price?: number;
}

interface MlOrder {
  id: number | string;
  status: string;
  date_created?: string;
  total_amount?: number;
  buyer?: { nickname?: string };
  order_items?: MlOrderItem[];
  shipping?: { id?: number };
}

@Injectable()
export class MercadoLivreClient {
  private readonly logger = new Logger(MercadoLivreClient.name);
  private tokenEmMemoria: { valor: string; expiraEm: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private get credenciais() {
    return {
      appId: this.config.get<string>('ML_APP_ID') ?? '',
      secret: this.config.get<string>('ML_SECRET_KEY') ?? '',
      refreshToken: this.config.get<string>('ML_REFRESH_TOKEN') ?? '',
      sellerId: this.config.get<string>('ML_SELLER_ID') ?? '',
    };
  }

  estaConfigurado(): boolean {
    const c = this.credenciais;
    return Boolean(c.appId && c.secret && c.refreshToken && c.sellerId);
  }

  /**
   * Devolve um access_token válido, renovando quando falta pouco pra expirar.
   *
   * A margem de 5 minutos existe porque o token pode vencer entre a checagem e a
   * chamada — sem ela, uma requisição longa esbarra em 401 no meio do processamento.
   *
   * O refresh_token é rotativo no ML: cada refresh devolve um novo e invalida o antigo.
   * Guardamos só em memória, então reiniciar o processo volta a usar o da env — que
   * pode já ter sido queimado. Persistir isso é a próxima peça a construir.
   */
  private async tokenValido(): Promise<string> {
    const agora = Date.now();
    if (this.tokenEmMemoria && this.tokenEmMemoria.expiraEm - 300_000 > agora) {
      return this.tokenEmMemoria.valor;
    }

    const { appId, secret, refreshToken } = this.credenciais;
    const resposta = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: appId,
        client_secret: secret,
        refresh_token: refreshToken,
      }),
    });

    if (!resposta.ok) {
      throw new Error(`ML oauth/token: HTTP ${resposta.status} — ${await resposta.text()}`);
    }
    const json = (await resposta.json()) as { access_token: string; expires_in: number };
    this.tokenEmMemoria = {
      valor: json.access_token,
      expiraEm: agora + json.expires_in * 1000,
    };
    return json.access_token;
  }

  private async chamar<T>(path: string): Promise<T> {
    const token = await this.tokenValido();
    const resposta = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!resposta.ok) {
      throw new Error(`ML ${path}: HTTP ${resposta.status} — ${await resposta.text()}`);
    }
    return (await resposta.json()) as T;
  }

  /** Um pedido específico — é o que o webhook `orders_v2` manda buscar. */
  async buscarPedido(orderId: string): Promise<PedidoImportado> {
    const pedido = await this.chamar<MlOrder>(`/orders/${orderId}`);
    return this.normalizar(pedido);
  }

  /** Pedidos pagos recentes. Rede de segurança pra webhook perdido, não caminho principal. */
  async listarPedidosPagos(desde: Date): Promise<PedidoImportado[]> {
    const { sellerId } = this.credenciais;
    const query = new URLSearchParams({
      seller: sellerId,
      'order.status': 'paid',
      'order.date_created.from': desde.toISOString(),
      sort: 'date_desc',
      limit: '50',
    });
    const r = await this.chamar<{ results?: MlOrder[] }>(`/orders/search?${query}`);
    return (r.results ?? []).map((o) => this.normalizar(o));
  }

  /**
   * Traduz o pedido do ML pro formato interno.
   *
   * O SKU pode vir em `seller_sku` ou no legado `seller_custom_field`; anúncios antigos
   * só têm o segundo. Sem nenhum dos dois, cai pro `item.id` (MLB...) — que não vai casar
   * com o catálogo, mas deixa o item rastreável em vez de perder a referência.
   * Valores vêm em REAIS com decimal, como na Shopee.
   */
  private normalizar(o: MlOrder): PedidoImportado {
    const itens: ItemImportado[] = (o.order_items ?? []).map((linha) => ({
      skuExterno:
        linha.item?.seller_sku || linha.item?.seller_custom_field || linha.item?.id || '',
      nomeExterno: linha.item?.title ?? '',
      qtd: linha.quantity ?? 1,
      precoUnitarioCentavos: Math.round((linha.unit_price ?? 0) * 100),
    }));

    return {
      canal: 'ML',
      externalId: String(o.id),
      statusExterno: o.status,
      compradorNome: o.buyer?.nickname ?? null,
      totalCentavos: Math.round((o.total_amount ?? 0) * 100),
      // O ML não expõe prazo de despacho no pedido — ele vive no recurso de shipment,
      // que exige outra chamada. Fica null até implementarmos essa busca.
      prazoEnvio: null,
      dataPedido: o.date_created ? new Date(o.date_created) : new Date(),
      itens,
    };
  }
}
