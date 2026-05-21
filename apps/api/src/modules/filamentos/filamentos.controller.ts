import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  FilamentoCreateSchema,
  FilamentoUpdateSchema,
  type FilamentoCreate,
  type FilamentoUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FilamentosService } from './filamentos.service';

@ApiTags('filamentos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('filamentos')
export class FilamentosController {
  constructor(private readonly service: FilamentosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(FilamentoCreateSchema)) data: FilamentoCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(FilamentoUpdateSchema)) data: FilamentoUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.service.desativar(id);
  }
}
