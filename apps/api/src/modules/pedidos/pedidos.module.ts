import { Module } from '@nestjs/common';
import { ProducaoModule } from '../producao/producao.module';
import { AtendimentoService } from './atendimento.service';
import { MercadoLivreModule } from '../mercado-livre/mercado-livre.module';
import { PedidosController } from './pedidos.controller';
import { PedidosSyncService } from './pedidos-sync.service';
import { ShopeeOrdersClient } from './shopee-orders.client';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [ProducaoModule, MercadoLivreModule],
  controllers: [PedidosController, WebhookController],
  providers: [AtendimentoService, PedidosSyncService, ShopeeOrdersClient],
  exports: [AtendimentoService],
})
export class PedidosModule {}
