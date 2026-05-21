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
  InsumoCreateSchema,
  InsumoUpdateSchema,
  type InsumoCreate,
  type InsumoUpdate,
} from '@mahou-hub/contracts';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { InsumosService } from './insumos.service';

@ApiTags('insumos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('insumos')
export class InsumosController {
  constructor(private readonly service: InsumosService) {}

  @Get()
  list(@Query('incluirInativos') incluirInativos?: string) {
    return this.service.list(incluirInativos === 'true');
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(InsumoCreateSchema)) data: InsumoCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(InsumoUpdateSchema)) data: InsumoUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  desativar(@Param('id') id: string) {
    return this.service.desativar(id);
  }
}
