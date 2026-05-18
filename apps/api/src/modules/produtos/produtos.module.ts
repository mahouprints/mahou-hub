import { Module } from '@nestjs/common';
import { ImagensModule } from '../imagens/imagens.module';
import { ProdutosService } from './produtos.service';
import { ProdutosController } from './produtos.controller';

@Module({
  imports: [ImagensModule],
  providers: [ProdutosService],
  controllers: [ProdutosController],
  exports: [ProdutosService],
})
export class ProdutosModule {}
