import { Module } from '@nestjs/common';
import { ConcorrentesController } from './concorrentes.controller';
import { ConcorrentesService } from './concorrentes.service';
import { ConcorrentesCron } from './concorrentes.cron';
import { ShopeeAffiliateService } from './shopee-affiliate.service';

@Module({
  controllers: [ConcorrentesController],
  providers: [ConcorrentesService, ShopeeAffiliateService, ConcorrentesCron],
  // Exporta ShopeeAffiliateService pra reuso no módulo Oportunidades (ShopeeProvider).
  exports: [ConcorrentesService, ShopeeAffiliateService],
})
export class ConcorrentesModule {}
