import { Module } from '@nestjs/common';
import { ProdutosService } from './produtos.service.js';
import { ProdutosController } from './produtos.controller.js';

@Module({
  providers: [ProdutosService],
  controllers: [ProdutosController],
  exports: [ProdutosService],
})
export class ProdutosModule {}
