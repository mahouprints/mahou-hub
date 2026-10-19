import { Module } from '@nestjs/common';
import { ImagensModule } from '../imagens/imagens.module';
import { ProdutosService } from './produtos.service';
import { ProdutosController } from './produtos.controller';
import { ProdutoMercadoLivreService } from './produto-mercado-livre.service';
import { MercadoLivreModule } from '../mercado-livre/mercado-livre.module';

@Module({
  imports: [ImagensModule, MercadoLivreModule],
  providers: [ProdutosService, ProdutoMercadoLivreService],
  controllers: [ProdutosController],
  exports: [ProdutosService],
})
export class ProdutosModule {}
