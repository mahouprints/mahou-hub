import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SyncOrigem } from '@prisma/client';
import {
  BulkDeleteSchema,
  ConcorrenteCreateFromLinkSchema,
  ConcorrenteCreateSchema,
  ConcorrenteLinkShopeeSchema,
  ConcorrenteUpdateSchema,
  type BulkDelete,
  type ConcorrenteCreate,
  type ConcorrenteCreateFromLink,
  type ConcorrenteLinkShopee,
  type ConcorrenteUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ConcorrentesService } from './concorrentes.service';

@ApiTags('concorrentes')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('concorrentes')
export class ConcorrentesController {
  constructor(private readonly service: ConcorrentesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista lojas concorrentes monitoradas',
    description: 'Inclui `vendasAfiliadoMesTotal` agregado do snapshot mais recente.',
  })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma loja concorrente' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/produtos')
  @ApiOperation({
    summary: 'Atalho: produtos do snapshot mais recente da loja',
    description:
      'Substitui o fluxo de 3 chamadas (lista loja → snapshots → snapshot por id) ' +
      'pra consumers que só querem o catálogo atual. Devolve `{ snapshotId, sincronizadoEm, produtos[] }`.',
  })
  produtosUltimoSnapshot(@Param('id') id: string) {
    return this.service.getProdutosUltimoSnapshot(id);
  }

  @Get(':id/snapshots')
  @ApiOperation({ summary: 'Lista o histórico de snapshots da loja' })
  listSnapshots(@Param('id') id: string) {
    return this.service.listSnapshots(id);
  }

  @Get(':id/snapshots/:snapshotId')
  @ApiOperation({ summary: 'Detalha um snapshot específico (com produtos)' })
  getSnapshot(@Param('id') id: string, @Param('snapshotId') snapshotId: string) {
    return this.service.getSnapshot(id, snapshotId);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra concorrente manual (sem link Shopee)' })
  create(@Body(new ZodValidationPipe(ConcorrenteCreateSchema)) data: ConcorrenteCreate) {
    return this.service.create(data);
  }

  @Post('from-link')
  @ApiOperation({
    summary: 'Cadastra concorrente a partir de URL Shopee (resolve shopId e sincroniza)',
  })
  createFromLink(
    @Body(new ZodValidationPipe(ConcorrenteCreateFromLinkSchema)) data: ConcorrenteCreateFromLink,
  ) {
    return this.service.createFromLink(data.url);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Dispara sync manual via Shopee Affiliate API (gera novo snapshot)' })
  sync(@Param('id') id: string) {
    return this.service.syncFromShopee(id, SyncOrigem.MANUAL);
  }

  @Post(':id/link-shopee')
  @ApiOperation({ summary: 'Linka concorrente manual existente a uma loja Shopee' })
  linkShopee(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ConcorrenteLinkShopeeSchema)) data: ConcorrenteLinkShopee,
  ) {
    return this.service.linkShopee(id, data.url);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza campos do concorrente (parcial)' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ConcorrenteUpdateSchema)) data: ConcorrenteUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove concorrente (hard delete, cascade nos snapshots)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Remove em massa (até 500 ids)' })
  bulkDelete(@Body(new ZodValidationPipe(BulkDeleteSchema)) data: BulkDelete) {
    return this.service.removeMuitos(data.ids);
  }
}
