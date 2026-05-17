import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FinanceiroService } from './financeiro.service';

@UseGuards(JwtAuthGuard)
@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly service: FinanceiroService) {}

  @Get('resumo')
  resumo(@Query('mes') mes: string) {
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      throw new BadRequestException("Query 'mes' obrigatória no formato YYYY-MM");
    }
    return this.service.resumoMensal(mes);
  }
}
