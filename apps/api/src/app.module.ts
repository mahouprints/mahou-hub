import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ProdutosModule } from './modules/produtos/produtos.module.js';
import { FilamentosModule } from './modules/filamentos/filamentos.module.js';
import { ParametrosModule } from './modules/parametros/parametros.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';
import { HealthController } from './modules/health/health.controller.js';

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
