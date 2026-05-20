import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
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
  });

  app.setGlobalPrefix('api', { exclude: ['healthz'] });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`api ouvindo em :${port}`);
}

void bootstrap();
