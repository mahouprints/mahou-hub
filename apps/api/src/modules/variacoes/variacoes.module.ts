import { Module } from '@nestjs/common';
import { VariacoesService } from './variacoes.service';
import { VariacoesController } from './variacoes.controller';

@Module({
  providers: [VariacoesService],
  controllers: [VariacoesController],
  exports: [VariacoesService],
})
export class VariacoesModule {}
