import { Body, Controller, Get, Header, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ConfiguracaoRelatoriosUpdateSchema,
  RelatorioFinanceiroQuerySchema,
  type ConfiguracaoRelatoriosUpdate,
  type RelatorioFinanceiroQuery,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RelatoriosConfiguracaoService } from './relatorios-configuracao.service';
import { RelatoriosService } from './relatorios.service';

@ApiTags('relatorios')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(
    private readonly service: RelatoriosService,
    private readonly configuracao: RelatoriosConfiguracaoService,
  ) {}

  @Get('configuracao')
  get() {
    return this.configuracao.get();
  }

  @Put('configuracao')
  salvar(
    @Body(new ZodValidationPipe(ConfiguracaoRelatoriosUpdateSchema))
    entrada: ConfiguracaoRelatoriosUpdate,
  ) {
    return this.configuracao.salvar(entrada);
  }

  @Post('integracao')
  @Header('Cache-Control', 'no-store')
  codigo() {
    return this.configuracao.codigo();
  }

  @Get('envios')
  listar() {
    return this.service.listar();
  }

  @Post('enviar')
  enviar(
    @Body(new ZodValidationPipe(RelatorioFinanceiroQuerySchema)) entrada: RelatorioFinanceiroQuery,
  ) {
    return this.service.enviar(entrada);
  }
}
