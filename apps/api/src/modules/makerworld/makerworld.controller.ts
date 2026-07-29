import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AnuncioModeloUpsertSchema,
  MakerworldBulkImportSchema,
  MakerworldBulkStatusSchema,
  MakerworldListarSchema,
  MakerworldUpdateSchema,
  type AnuncioModeloUpsert,
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
  @ApiOperation({ summary: 'Modelo com economia, plano de ROAS e anúncios já gerados' })
  buscar(@Param('id') id: string) {
    return this.service.buscarDetalhe(id);
  }

  @Post(':id/anuncios')
  @ApiOperation({ summary: 'Grava a copy gerada pela skill para um marketplace (upsert)' })
  salvarAnuncio(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AnuncioModeloUpsertSchema)) body: AnuncioModeloUpsert,
  ) {
    return this.service.salvarAnuncio(id, body);
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
