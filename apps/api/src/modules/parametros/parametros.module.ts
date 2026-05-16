import { Module } from '@nestjs/common';
import { ParametrosService } from './parametros.service.js';
import { ParametrosController } from './parametros.controller.js';

@Module({
  providers: [ParametrosService],
  controllers: [ParametrosController],
  exports: [ParametrosService],
})
export class ParametrosModule {}
