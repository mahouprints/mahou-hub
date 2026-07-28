import { Module } from '@nestjs/common';
import { MakerworldController } from './makerworld.controller';
import { MakerworldService } from './makerworld.service';

@Module({
  controllers: [MakerworldController],
  providers: [MakerworldService],
})
export class MakerworldModule {}
