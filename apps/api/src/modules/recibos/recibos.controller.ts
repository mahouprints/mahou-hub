import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ReciboCreateSchema,
  ReciboItemUpdateSchema,
  ReciboUpdateSchema,
  type ReciboCreate,
  type ReciboItemUpdate,
  type ReciboUpdate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ConfirmacaoReciboService } from './confirmacao-recibo.service';
import { ExtracaoReciboService } from './extracao-recibo.service';
import { RecibosService } from './recibos.service';

@ApiTags('recibos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('recibos')
export class RecibosController {
  constructor(
    private readonly service: RecibosService,
    private readonly extracao: ExtracaoReciboService,
    private readonly confirmacao: ConfirmacaoReciboService,
  ) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(ReciboCreateSchema)) data: ReciboCreate) {
    return this.service.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReciboUpdateSchema)) data: ReciboUpdate,
  ) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/arquivos')
  @UseInterceptors(FilesInterceptor('arquivos', 10))
  addArquivos(@Param('id') id: string, @UploadedFiles() arquivos: Express.Multer.File[]) {
    return this.service.addArquivos(id, arquivos ?? []);
  }

  @Post(':id/extrair')
  @ApiOperation({
    summary: 'Lê a nota anexada com o Gemini e devolve o que foi extraído para revisão',
  })
  // Uma leitura leva segundos e gasta cota; o limite global de 100/min não protege disso.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  extrair(@Param('id') id: string) {
    return this.extracao.extrair(id);
  }

  @Patch(':id/itens/:itemId')
  @ApiOperation({ summary: 'Corrige uma linha lida da nota antes de confirmar' })
  atualizarItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(ReciboItemUpdateSchema)) data: ReciboItemUpdate,
  ) {
    return this.service.atualizarItem(id, itemId, data);
  }

  @Post(':id/confirmar')
  @ApiOperation({
    summary: 'Aplica o recibo revisado: estocáveis viram saldo, não-estocáveis viram custo',
  })
  confirmar(@Param('id') id: string) {
    return this.confirmacao.confirmar(id);
  }

  @Delete(':id/arquivos/:arquivoId')
  removeArquivo(@Param('id') id: string, @Param('arquivoId') arquivoId: string) {
    return this.service.removeArquivo(id, arquivoId);
  }
}
