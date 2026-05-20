import { Module } from '@nestjs/common';
import { ConcorrentesController } from './concorrentes.controller';
import { ConcorrentesService } from './concorrentes.service';
import { ConcorrentesCron } from './concorrentes.cron';
import { ShopeeAffiliateService } from './shopee-affiliate.service';

@Module({
  controllers: [ConcorrentesController],
  providers: [ConcorrentesService, ShopeeAffiliateService, ConcorrentesCron],
  exports: [ConcorrentesService],
})
export class ConcorrentesModule {}
