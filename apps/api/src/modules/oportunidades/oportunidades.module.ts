import { Module } from '@nestjs/common';
import { ConcorrentesModule } from '../concorrentes/concorrentes.module';
import { DescobertaService } from './descoberta.service';
import { OportunidadeLogService } from './oportunidade-log.service';
import { OportunidadesController } from './oportunidades.controller';
import { OportunidadesCron } from './oportunidades.cron';
import { OportunidadesService } from './oportunidades.service';
import { MARKETPLACE_PROVIDERS } from './providers/marketplace-provider';
import { ShopeeProvider } from './providers/shopee.provider';

@Module({
  imports: [ConcorrentesModule],
  controllers: [OportunidadesController],
  providers: [
    OportunidadesService,
    OportunidadeLogService,
    DescobertaService,
    OportunidadesCron,
    ShopeeProvider,
    // Multi-inject de providers. Pra adicionar TikTok no futuro: cria classe TiktokProvider
    // e adiciona aqui dentro do useFactory (inject + array).
    {
      provide: MARKETPLACE_PROVIDERS,
      useFactory: (shopee: ShopeeProvider) => [shopee],
      inject: [ShopeeProvider],
    },
  ],
})
export class OportunidadesModule {}
