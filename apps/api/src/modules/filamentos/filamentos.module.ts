import { Module } from '@nestjs/common';
import { FilamentosService } from './filamentos.service.js';
import { FilamentosController } from './filamentos.controller.js';

@Module({
  providers: [FilamentosService],
  controllers: [FilamentosController],
  exports: [FilamentosService],
})
export class FilamentosModule {}
