import { Module } from '@nestjs/common';
import { MakerworldController } from './makerworld.controller';
import { MakerworldService } from './makerworld.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [MakerworldController],
  providers: [MakerworldService],
})
export class MakerworldModule {}
