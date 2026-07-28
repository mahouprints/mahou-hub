import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  MakerworldBulkImportSchema,
  MakerworldBulkStatusSchema,
  MakerworldListarSchema,
  MakerworldUpdateSchema,
  type MakerworldBulkImport,
  type MakerworldBulkStatus,
  type MakerworldListar,
  type MakerworldUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MakerworldService } from './makerworld.service';

@ApiTags('makerworld')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('makerworld')
export class MakerworldController {
  constructor(private readonly service: MakerworldService) {}

  // Limite mais alto que o global: o bot manda os candidatos em lotes seguidos de 200
  // logo depois de uma varredura, e 100 req/min derrubaria a importação no meio.
  @Post('bulk-import')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @ApiOperation({ summary: 'Importa modelos prospectados pelo bot do MakerWorld (upsert)' })
  importar(@Body(new ZodValidationPipe(MakerworldBulkImportSchema)) body: MakerworldBulkImport) {
    return this.service.importarEmLote(body);
  }

  @Get()
  @ApiOperation({ summary: 'Lista modelos prospectados, com filtros de revisão' })
  listar(@Query(new ZodValidationPipe(MakerworldListarSchema)) query: MakerworldListar) {
    return this.service.listar(query);
  }

  @Get('resumo')
  @ApiOperation({ summary: 'Contagens por nicho e status para os cards da tela' })
  resumo() {
    return this.service.resumo();
  }

  @Get(':id')
  buscar(@Param('id') id: string) {
    return this.service.buscarPorId(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza status, nicho ou observação de um modelo' })
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MakerworldUpdateSchema)) body: MakerworldUpdate,
  ) {
    return this.service.atualizar(id, body);
  }

  @Post('bulk-status')
  @ApiOperation({ summary: 'Marca vários modelos de uma vez (favoritar/descartar em massa)' })
  mudarStatus(
    @Body(new ZodValidationPipe(MakerworldBulkStatusSchema)) body: MakerworldBulkStatus,
  ) {
    return this.service.mudarStatusEmLote(body.ids, body.status);
  }
}
