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
import { SyncOrigem } from '@prisma/client';
import {
  BulkDeleteSchema,
  ConcorrenteCreateFromLinkSchema,
  ConcorrenteCreateSchema,
  ConcorrenteUpdateSchema,
  type BulkDelete,
  type ConcorrenteCreate,
  type ConcorrenteCreateFromLink,
  type ConcorrenteUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ConcorrentesService } from './concorrentes.service';

@UseGuards(JwtAuthGuard)
@Controller('concorrentes')
export class ConcorrentesController {
  constructor(private readonly service: ConcorrentesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/snapshots')
  listSnapshots(@Param('id') id: string) {
    return this.service.listSnapshots(id);
  }

  @Get(':id/snapshots/:snapshotId')
  getSnapshot(@Param('id') id: string, @Param('snapshotId') snapshotId: string) {
    return this.service.getSnapshot(id, snapshotId);
  }

  @Post()
  create(@Body(new ZodValidationPipe(ConcorrenteCreateSchema)) data: ConcorrenteCreate) {
    return this.service.create(data);
  }

  @Post('from-link')
  createFromLink(
    @Body(new ZodValidationPipe(ConcorrenteCreateFromLinkSchema)) data: ConcorrenteCreateFromLink,
  ) {
    return this.service.createFromLink(data.url);
  }

  @Post(':id/sync')
  sync(@Param('id') id: string) {
    return this.service.syncFromShopee(id, SyncOrigem.MANUAL);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ConcorrenteUpdateSchema)) data: ConcorrenteUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('bulk-delete')
  bulkDelete(@Body(new ZodValidationPipe(BulkDeleteSchema)) data: BulkDelete) {
    return this.service.removeMuitos(data.ids);
  }
}
