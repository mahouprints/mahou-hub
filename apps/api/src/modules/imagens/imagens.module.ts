import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImagensController } from './imagens.controller';
import { ImagensService } from './imagens.service';
import { MediaUrlService } from './media-url.service';

@Module({
  imports: [
    // memoryStorage: o buffer chega no service, que processa com sharp e
    // só persiste o resultado final em disco (sem arquivo temporário).
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 10 },
    }),
  ],
  providers: [ImagensService, MediaUrlService],
  controllers: [ImagensController],
  exports: [ImagensService, MediaUrlService],
})
export class ImagensModule {}
