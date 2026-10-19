import { Module } from '@nestjs/common';
import { VariacoesService } from './variacoes.service';
import { VariacoesController } from './variacoes.controller';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  providers: [VariacoesService],
  controllers: [VariacoesController],
  exports: [VariacoesService],
})
export class VariacoesModule {}
