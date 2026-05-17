import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProdutosModule } from './modules/produtos/produtos.module';
import { FilamentosModule } from './modules/filamentos/filamentos.module';
import { ParametrosModule } from './modules/parametros/parametros.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { VendasModule } from './modules/vendas/vendas.module';
import { CustosModule } from './modules/custos/custos.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization', 'req.headers.cookie', '*.senha', '*.senhaHash'],
      },
    }),
    PrismaModule,
    AuthModule,
    ProdutosModule,
    FilamentosModule,
    ParametrosModule,
    PricingModule,
    VendasModule,
    CustosModule,
    FinanceiroModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
