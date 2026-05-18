import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
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

const BulkAnunciarSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  anunciado: z.boolean(),
});
type BulkAnunciar = z.infer<typeof BulkAnunciarSchema>;

@UseGuards(JwtAuthGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Get()
  list(@Query('anunciado') anunciado?: string) {
    const filtro = anunciado === 'true' ? true : anunciado === 'false' ? false : undefined;
    return this.service.list({ anunciado: filtro });
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

  @Post('bulk-anunciar')
  bulkAnunciar(@Body(new ZodValidationPipe(BulkAnunciarSchema)) data: BulkAnunciar) {
    return this.service.marcarAnunciados(data.ids, data.anunciado);
  }
}
