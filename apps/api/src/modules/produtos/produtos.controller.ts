import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  BulkDeleteSchema,
  ProdutoCreateSchema,
  ProdutoUpdateSchema,
  type BulkDelete,
  type ProdutoCreate,
  type ProdutoUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ProdutosService } from './produtos.service';

@UseGuards(JwtAuthGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/estatisticas')
  estatisticas(@Param('id') id: string) {
    return this.service.estatisticas(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(ProdutoCreateSchema)) data: ProdutoCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProdutoUpdateSchema)) data: ProdutoUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.service.desativar(id);
  }

  @Post('bulk-delete')
  bulkDelete(@Body(new ZodValidationPipe(BulkDeleteSchema)) data: BulkDelete) {
    return this.service.desativarMuitos(data.ids);
  }
}
