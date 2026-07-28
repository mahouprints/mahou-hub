import { Module } from '@nestjs/common';
import { AtendimentoService } from './atendimento.service';
import { MercadoLivreClient } from './mercadolivre.client';
import { PedidosController } from './pedidos.controller';
import { PedidosSyncService } from './pedidos-sync.service';
import { ShopeeOrdersClient } from './shopee-orders.client';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [PedidosController, WebhookController],
  providers: [AtendimentoService, PedidosSyncService, ShopeeOrdersClient, MercadoLivreClient],
  exports: [AtendimentoService],
})
export class PedidosModule {}
