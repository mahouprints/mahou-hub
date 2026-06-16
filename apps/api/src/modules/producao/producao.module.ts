import { Module } from '@nestjs/common';
import { EstoqueModule } from '../estoque/estoque.module';
import { ProducaoService } from './producao.service';
import { ProducaoController } from './producao.controller';

@Module({
  // EstoqueModule exporta EstoqueService — usado pra baixa automática de filamento.
  imports: [EstoqueModule],
  providers: [ProducaoService],
  controllers: [ProducaoController],
})
export class ProducaoModule {}
