import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FinanceiroService } from './financeiro.service';
import {
  RelatorioFinanceiroQuerySchema,
  type RelatorioFinanceiroQuery,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@ApiTags('financeiro')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly service: FinanceiroService) {}

  @Get('relatorio')
  @ApiOperation({
    summary: 'Relatório financeiro semanal, mensal ou anual com detalhes e série temporal',
  })
  @ApiQuery({ name: 'periodo', enum: ['SEMANAL', 'MENSAL', 'ANUAL'] })
  @ApiQuery({
    name: 'referencia',
    example: '2026-09-20',
    description: 'Dia civil existente no formato YYYY-MM-DD',
  })
  relatorio(
    @Query(new ZodValidationPipe(RelatorioFinanceiroQuerySchema)) entrada: RelatorioFinanceiroQuery,
  ) {
    return this.service.relatorio(entrada);
  }

  @Get('resumo')
  resumo(@Query('mes') mes: string) {
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      throw new BadRequestException("Query 'mes' obrigatória no formato YYYY-MM");
    }
    return this.service.resumoMensal(mes);
  }
}
