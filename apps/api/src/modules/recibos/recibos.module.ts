import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImagensModule } from '../imagens/imagens.module';
import { RecibosService } from './recibos.service';
import { RecibosController } from './recibos.controller';

@Module({
  imports: [
    // ImagensModule exporta MediaUrlService (reusado pra resolver URL pública dos anexos).
    ImagensModule,
    // memoryStorage: buffer chega no service, que salva bruto em disco (sem sharp).
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024, files: 10 },
    }),
  ],
  providers: [RecibosService],
  controllers: [RecibosController],
})
export class RecibosModule {}
