import { Module } from '@nestjs/common';
import { MercadoLivreClient } from '../pedidos/mercadolivre.client';
import { MercadoLivreController } from './mercado-livre.controller';
import { MercadoLivreHttpService } from './mercado-livre-http.service';
import { MercadoLivreService } from './mercado-livre.service';
import { MercadoLivreCustosService } from './mercado-livre-custos.service';

@Module({
  controllers: [MercadoLivreController],
  providers: [
    MercadoLivreHttpService,
    MercadoLivreService,
    MercadoLivreCustosService,
    MercadoLivreClient,
  ],
  exports: [MercadoLivreService, MercadoLivreClient],
})
export class MercadoLivreModule {}
