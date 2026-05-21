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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  BulkDeleteSchema,
  OportunidadeBulkCreateSchema,
  OportunidadeBuscarSchema,
  OportunidadeCreateSchema,
  OportunidadeExplorarSchema,
  OportunidadeUpdateSchema,
  OportunidadeVirarProdutoSchema,
  type BulkDelete,
  type OportunidadeBulkCreate,
  type OportunidadeBuscar,
  type OportunidadeCreate,
  type OportunidadeExplorar,
  type OportunidadeFonte,
  type OportunidadeMarketplace,
  type OportunidadeStatus,
  type OportunidadeUpdate,
  type OportunidadeVirarProduto,
} from '@mahou-hub/contracts';
import { CurrentUser, type AuthUser } from '../../common/current-user.decorator';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DescobertaService } from './descoberta.service';
import { OportunidadesCron } from './oportunidades.cron';
import { OportunidadesService } from './oportunidades.service';
import { CATEGORIAS_SHOPEE_3D } from './providers/shopee-categorias-3d';

@ApiTags('oportunidades')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('oportunidades')
export class OportunidadesController {
  constructor(
    private readonly service: OportunidadesService,
    private readonly descoberta: DescobertaService,
    private readonly cron: OportunidadesCron,
  ) {}

  // Trigger manual do cron baseline — útil em dev/staging pra popular o backlog sem esperar domingo.
  @Post('_cron/run')
  @ApiOperation({ summary: '(Admin) Dispara o cron baseline agora — devolve counts' })
  rodarCronBaseline() {
    return this.cron.descobrirNoveProdutos();
  }

  // Throttle mais agressivo nesses 2: cada chamada itera até 20 páginas na Shopee Affiliate
  // (até 1000 produtos brutos). Sem isso, Claude via MCP pode disparar 50/min e estourar quota.
  @Post('buscar')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Busca direcionada de produtos no marketplace (keyword / categoria / concorrente)',
    description:
      'Não persiste — devolve candidatos enriquecidos com vendasEstimadasMes. ' +
      'Use POST / pra salvar no backlog os que valem a pena. **Rate-limit: 20 req/min.**',
  })
  buscar(@Body(new ZodValidationPipe(OportunidadeBuscarSchema)) data: OportunidadeBuscar) {
    return this.descoberta.buscar(data.marketplace, data, data.filtros ?? {});
  }

  @Post('explorar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Modo brainstorm: top vendas do marketplace sem filtro de nicho',
    description:
      'Usado pelo Claude pra varrer "o que tá bombando" e curar manualmente o que vale ' +
      'pra impressão 3D. Aplique filtros mínimos (vendasMin, faixa de preço) pra reduzir ruído. ' +
      '**Rate-limit: 10 req/min** (chamada mais cara — sem nicho, varre top global).',
  })
  explorar(@Body(new ZodValidationPipe(OportunidadeExplorarSchema)) data: OportunidadeExplorar) {
    return this.descoberta.explorar(data.marketplace, data.filtros ?? {});
  }

  @Get()
  @ApiOperation({ summary: 'Lista backlog de oportunidades' })
  list(
    @Query('status') status?: OportunidadeStatus,
    @Query('scoreMin') scoreMin?: string,
    @Query('fonte') fonte?: OportunidadeFonte,
    @Query('marketplace') marketplace?: OportunidadeMarketplace,
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.list({
      status,
      scoreMin: scoreMin != null ? Number(scoreMin) : undefined,
      fonte,
      marketplace,
      q,
      take: take != null ? Number(take) : undefined,
      skip: skip != null ? Number(skip) : undefined,
    });
  }

  @Get('estatisticas')
  @ApiOperation({ summary: 'Counts por status, fonte e marketplace (contexto pro Claude)' })
  estatisticas() {
    return this.service.estatisticas();
  }

  @Get('categorias-3d')
  @ApiOperation({
    summary: 'Categorias Shopee curadas como relevantes pra impressão 3D',
    description:
      'Lista parcial pra orientar `buscar` com tipo=categoria. Não é exaustiva — ' +
      'descobrir outras via `productCatIds` dos resultados de keyword.',
  })
  categorias3d() {
    return CATEGORIAS_SHOPEE_3D;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma oportunidade' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/historico')
  @ApiOperation({
    summary: 'Histórico de mudanças da oportunidade (audit trail append-only)',
    description:
      'Eventos: CREATED, STATUS_CHANGE, SCORE_CHANGE, NOTAS_CHANGE, VIRARAM_PRODUTO. ' +
      '`usuarioId=null` indica mudança feita pelo sistema (cron).',
  })
  historico(@Param('id') id: string) {
    return this.service.historico(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Salva oportunidade no backlog (upsert por marketplace+externalId)',
  })
  create(
    @Body(new ZodValidationPipe(OportunidadeCreateSchema)) data: OportunidadeCreate,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.create(data, user?.sub ?? null);
  }

  @Post('bulk')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Salva várias oportunidades de uma vez (até 200)',
    description: '**Rate-limit: 30 req/min** (Claude salva batches após brainstorm).',
  })
  createBulk(
    @Body(new ZodValidationPipe(OportunidadeBulkCreateSchema)) data: OportunidadeBulkCreate,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.createBulk(data, user?.sub ?? null);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza status, score e/ou notas' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OportunidadeUpdateSchema)) data: OportunidadeUpdate,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.update(id, data, user?.sub ?? null);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove oportunidade do backlog (hard delete)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('bulk-delete')
  @ApiOperation({ summary: 'Remove em massa (até 500 ids)' })
  bulkDelete(@Body(new ZodValidationPipe(BulkDeleteSchema)) data: BulkDelete) {
    return this.service.removeMuitos(data.ids);
  }

  @Post(':id/virar-produto')
  @ApiOperation({
    summary: 'Promove oportunidade a Produto (completo ou rascunho)',
    description:
      'Pré-preenche nome (do productName), inspiracao (productLink), precoCentavos ' +
      '(média de min/max), canalPrincipal (do marketplace). Se filamento/peso/tempo/impressora ' +
      'estiverem completos, vira Produto ativo. Se algum faltar, vira rascunho (ativo=false).',
  })
  virarProduto(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(OportunidadeVirarProdutoSchema)) data: OportunidadeVirarProduto,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.service.virarProduto(id, data, user?.sub ?? null);
  }
}
