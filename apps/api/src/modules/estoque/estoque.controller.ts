import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MovimentoCreateSchema, type MovimentoCreate } from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EstoqueService } from './estoque.service';

@ApiTags('estoque')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly service: EstoqueService) {}

  @Post('movimentos')
  registrar(@Body(new ZodValidationPipe(MovimentoCreateSchema)) data: MovimentoCreate) {
    return this.service.registrarMovimento(data);
  }

  @Get('movimentos')
  historico(
    @Query('tipoItem') tipoItem?: 'PRODUTO' | 'FILAMENTO' | 'INSUMO',
    @Query('variacaoId') variacaoId?: string,
    @Query('filamentoId') filamentoId?: string,
    @Query('insumoId') insumoId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.historico({
      tipoItem,
      variacaoId,
      filamentoId,
      insumoId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('alertas')
  alertas() {
    return this.service.alertas();
  }
}
