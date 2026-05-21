import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

// Serializa BigInt como string no JSON. Necessário pra modelos como ConcorrenteSnapshotProduto
// (itemId Int64) e Concorrente.shopId — sem isso, JSON.stringify joga TypeError.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:3001',
    credentials: true,
    // Sem isso, browser não deixa o JS consumer ler nossos headers customizados.
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Page-Size'],
  });

  // Prefixo versionado. Quando precisar quebrar contrato, monta `/api/v2` em
  // paralelo e mantém `/api/v1` por um período de deprecation.
  app.setGlobalPrefix('api/v1', { exclude: ['healthz'] });

  // OpenAPI/Swagger em /api/v1/docs (UI) e /api/v1/docs-json (spec).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mahou Hub API')
    .setDescription(
      'Backend do Mahou Hub. Use POST /api/v1/auth/api-token (autenticado) pra ' +
        'gerar um JWT de longa duração e cole no botão "Authorize" abaixo.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addCookieAuth('mahou_token', { type: 'apiKey', in: 'cookie', name: 'mahou_token' }, 'cookie')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`api ouvindo em :${port} (docs em /api/v1/docs)`);
}

void bootstrap();
