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
import {
  JobBulkCreateSchema,
  JobCreateSchema,
  JobStatusUpdateSchema,
  type JobBulkCreate,
  type JobCreate,
  type JobStatusUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ProducaoService } from './producao.service';

@ApiTags('producao')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('producao')
export class ProducaoController {
  constructor(private readonly service: ProducaoService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(JobCreateSchema)) data: JobCreate) {
    return this.service.create(data);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Cria vários jobs de uma vez (uma leva)',
    description: 'Cada item vira um card próprio na fila. Útil pra enfileirar várias peças juntas.',
  })
  createMany(@Body(new ZodValidationPipe(JobBulkCreateSchema)) data: JobBulkCreate) {
    return this.service.createMany(data.itens);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Muda o status do job',
    description: 'Ao marcar como CONCLUIDO (impresso), baixa o filamento consumido automaticamente.',
  })
  mudarStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(JobStatusUpdateSchema)) data: JobStatusUpdate,
  ) {
    return this.service.mudarStatus(id, data.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
