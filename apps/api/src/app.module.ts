import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProdutosModule } from './modules/produtos/produtos.module';
import { FilamentosModule } from './modules/filamentos/filamentos.module';
import { ImagensModule } from './modules/imagens/imagens.module';
import { InsumosModule } from './modules/insumos/insumos.module';
import { ParametrosModule } from './modules/parametros/parametros.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { VendasModule } from './modules/vendas/vendas.module';
import { CustosModule } from './modules/custos/custos.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { ConcorrentesModule } from './modules/concorrentes/concorrentes.module';
import { OportunidadesModule } from './modules/oportunidades/oportunidades.module';
import { VariacoesModule } from './modules/variacoes/variacoes.module';
import { EstoqueModule } from './modules/estoque/estoque.module';
import { RecibosModule } from './modules/recibos/recibos.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization', 'req.headers.cookie', '*.senha', '*.senhaHash'],
      },
    }),
    // Rate-limit global: 100 req/min por IP. Defesa contra loop bug de consumer
    // externo, não contra ataque coordenado (pra isso seria precoce — Cloudflare/
    // WAF resolveriam melhor quando vier).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    // Em prod, Nginx serve diretamente media.mahouprints.com → /var/mahou-storage.
    // Aqui no Nest é fallback útil pro dev (sem Nginx local).
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.STORAGE_DIR ?? './storage'),
      serveRoot: '/media',
      serveStaticOptions: { maxAge: '30d' },
    }),
    PrismaModule,
    AuthModule,
    ProdutosModule,
    FilamentosModule,
    ImagensModule,
    InsumosModule,
    ParametrosModule,
    PricingModule,
    VendasModule,
    CustosModule,
    FinanceiroModule,
    ConcorrentesModule,
    OportunidadesModule,
    VariacoesModule,
    EstoqueModule,
    RecibosModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
