import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EstoqueModule } from '../estoque/estoque.module';
import { ImagensModule } from '../imagens/imagens.module';
import { ConfirmacaoReciboService } from './confirmacao-recibo.service';
import { ExtracaoReciboService } from './extracao-recibo.service';
import { GeminiClient } from './gemini.client';
import { RecibosService } from './recibos.service';
import { RecibosController } from './recibos.controller';

@Module({
  imports: [
    // ImagensModule exporta MediaUrlService (reusado pra resolver URL pública dos anexos).
    ImagensModule,
    // Confirmar recibo lança movimento de COMPRA reusando as regras de saldo do estoque.
    EstoqueModule,
    // memoryStorage: buffer chega no service, que salva bruto em disco (sem sharp).
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024, files: 10 },
    }),
  ],
  providers: [RecibosService, GeminiClient, ExtracaoReciboService, ConfirmacaoReciboService],
  controllers: [RecibosController],
})
export class RecibosModule {}
