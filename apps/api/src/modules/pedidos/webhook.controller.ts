import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AtendimentoService } from './atendimento.service';
import { MercadoLivreClient } from './mercadolivre.client';

/**
 * Receptor de notificações do Mercado Livre.
 *
 * PÚBLICO de propósito — o ML chama de fora, sem JWT. Por isso:
 *  - o corpo traz só IDs, e a gente busca o pedido pela API autenticada. Nada do que
 *    chega aqui é confiado como dado: um POST forjado no máximo faz o Hub reconsultar
 *    um pedido que não existe, e a chamada autenticada devolve erro.
 *  - responde 200 imediatamente e processa depois. O ML considera falha qualquer
 *    resposta que demore mais de 500ms, e reenvia — processar antes de responder
 *    viraria retry infinito num pedido lento.
 */
@ApiExcludeController()
@Controller('pedidos/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly atendimento: AtendimentoService,
    private readonly ml: MercadoLivreClient,
  ) {}

  @Post()
  @HttpCode(200)
  // Limite alto: o ML dispara uma notificação por evento e uma venda gera várias
  // (criação, pagamento, envio). Estrangular aqui faria o ML reenviar em loop.
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  receber(@Body() body: { topic?: string; resource?: string; user_id?: number }) {
    const { topic, resource } = body ?? {};

    // Responde já; o processamento segue em background.
    void this.processar(topic, resource).catch((erro) => {
      this.logger.error(
        `Webhook ${topic}/${resource} falhou: ${erro instanceof Error ? erro.message : erro}`,
      );
    });

    return { ok: true };
  }

  private async processar(topic?: string, resource?: string) {
    if (!resource) return;

    // `orders_v2` manda resource "/orders/123456789"; shipments manda "/shipments/...".
    // Só orders interessa por enquanto — shipment vira status de envio quando
    // buscarmos o recurso de envio, que ainda não implementamos.
    if (topic !== 'orders_v2') {
      this.logger.log(`Webhook ignorado (topic ${topic ?? 'ausente'})`);
      return;
    }

    const orderId = resource.split('/').filter(Boolean).pop();
    if (!orderId) return;

    if (!this.ml.estaConfigurado()) {
      this.logger.warn(`Webhook de pedido ${orderId} recebido, mas o ML não está configurado`);
      return;
    }

    const pedido = await this.ml.buscarPedido(orderId);
    const r = await this.atendimento.importar(pedido);
    this.logger.log(
      `Webhook ML pedido ${orderId}: ${r.novo ? 'importado' : 'atualizado'}` +
        (r.itensSemVinculo ? ` · ${r.itensSemVinculo} item(ns) sem vínculo` : ''),
    );
  }
}
