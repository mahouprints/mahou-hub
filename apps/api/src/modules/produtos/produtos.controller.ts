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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
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

@ApiTags('produtos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os produtos ativos' })
  @ApiQuery({
    name: 'anunciado',
    required: false,
    enum: ['true', 'false'],
    description: 'Filtra por flag `anunciado`. Omitir traz todos.',
  })
  list(@Query('anunciado') anunciado?: string) {
    const filtro = anunciado === 'true' ? true : anunciado === 'false' ? false : undefined;
    return this.service.list({ anunciado: filtro });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um produto' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/estatisticas')
  @ApiOperation({ summary: 'Estatísticas agregadas de vendas do produto' })
  estatisticas(@Param('id') id: string) {
    return this.service.estatisticas(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria produto' })
  create(@Body(new ZodValidationPipe(ProdutoCreateSchema)) data: ProdutoCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza campos do produto (parcial)' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProdutoUpdateSchema)) data: ProdutoUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete: marca produto como ativo=false (preserva histórico)' })
  desativar(@Param('id') id: string) {
    return this.service.desativar(id);
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Soft-delete em massa (até 500 ids)' })
  bulkDelete(@Body(new ZodValidationPipe(BulkDeleteSchema)) data: BulkDelete) {
    return this.service.desativarMuitos(data.ids);
  }

  @Post('bulk-anunciar')
  @ApiOperation({
    summary: 'Marca/desmarca a flag `anunciado` em N produtos',
    description: 'Usado pelo fluxo externo de publicação: consumer chama com ids e `anunciado: true` após publicar.',
  })
  bulkAnunciar(@Body(new ZodValidationPipe(BulkAnunciarSchema)) data: BulkAnunciar) {
    return this.service.marcarAnunciados(data.ids, data.anunciado);
  }
}
