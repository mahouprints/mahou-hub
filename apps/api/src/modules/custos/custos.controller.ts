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
  CustoCreateSchema,
  CustoUpdateSchema,
  type BulkDelete,
  type CustoCreate,
  type CustoUpdate,
} from '@mahou-hub/contracts';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CustosService } from './custos.service';

@ApiTags('custos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('custos')
export class CustosController {
  constructor(private readonly service: CustosService) {}

  @Get()
  list(@Query('mes') mes?: string) {
    return this.service.list(mes);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(CustoCreateSchema)) data: CustoCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CustoUpdateSchema)) data: CustoUpdate,
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
