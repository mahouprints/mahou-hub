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
import {
  BulkDeleteSchema,
  VendaCreateSchema,
  VendaUpdateSchema,
  type BulkDelete,
  type VendaCreate,
  type VendaUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { VendasService } from './vendas.service';

@UseGuards(JwtAuthGuard)
@Controller('vendas')
export class VendasController {
  constructor(private readonly service: VendasService) {}

  @Get()
  list(@Query('mes') mes?: string) {
    return this.service.list(mes);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(VendaCreateSchema)) data: VendaCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(VendaUpdateSchema)) data: VendaUpdate,
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
