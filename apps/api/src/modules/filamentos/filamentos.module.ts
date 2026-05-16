import { Module } from '@nestjs/common';
import { FilamentosService } from './filamentos.service';
import { FilamentosController } from './filamentos.controller';

@Module({
  providers: [FilamentosService],
  controllers: [FilamentosController],
  exports: [FilamentosService],
})
export class FilamentosModule {}
