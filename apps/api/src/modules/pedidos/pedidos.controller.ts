import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  PedidoImportSchema,
  PedidoListarSchema,
  PedidoSyncSchema,
  PedidoVincularItemSchema,
  type PedidoImport,
  type PedidoListar,
  type PedidoSync,
  type PedidoVincularItem,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AtendimentoService } from './atendimento.service';
import { PedidosSyncService } from './pedidos-sync.service';

@ApiTags('pedidos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly atendimento: AtendimentoService,
    private readonly sync: PedidosSyncService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista pedidos importados dos marketplaces' })
  async listar(@Query(new ZodValidationPipe(PedidoListarSchema)) query: PedidoListar) {
    const itens = await this.prisma.pedidoMarketplace.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.canal ? { canal: query.canal } : {}),
        ...(query.somenteBloqueados ? { status: 'BLOQUEADO' } : {}),
      },
      include: {
        itens: {
          include: { variacao: { select: { sku: true, nome: true, estoqueAtual: true } } },
        },
      },
      // Prazo mais apertado primeiro: é a ordem em que precisam sair da impressora.
      // `nulls: 'last'` porque pedido sem prazo (ML) não pode encabeçar a lista.
      orderBy: [{ prazoEnvio: { sort: 'asc', nulls: 'last' } }, { dataPedido: 'desc' }],
      take: query.limit,
    });
    return { itens, total: itens.length };
  }

  @Get('pendencias')
  @ApiOperation({ summary: 'Itens com SKU sem vínculo — precisam de ação humana' })
  async pendencias() {
    const itens = await this.prisma.pedidoItem.findMany({
      where: { atendimento: 'SEM_VINCULO' },
      include: {
        pedido: { select: { canal: true, externalId: true, prazoEnvio: true, dataPedido: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
    return { total: itens.length, itens };
  }

  // Throttle apertado: cada chamada pagina os dois marketplaces e conta contra o
  // rate limit deles, não só contra o nosso.
  @Post('sync')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: 'Puxa pedidos novos dos marketplaces configurados' })
  sincronizar(@Query(new ZodValidationPipe(PedidoSyncSchema)) query: PedidoSync) {
    return this.sync.sincronizarTudo(query.horas);
  }

  @Post('itens/:id/vincular')
  @ApiOperation({ summary: 'Liga um item órfão a uma variação e atende na hora' })
  vincular(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PedidoVincularItemSchema)) body: PedidoVincularItem,
  ) {
    return this.atendimento.vincularItem(id, body.variacaoId);
  }

  /**
   * Importação manual — reprocessa um pedido sem esperar o cron, e é como os testes
   * de integração injetam pedido. Mesmo formato que os adaptadores produzem.
   */
  @Post('importar')
  @ApiOperation({ summary: '(Admin) Importa um pedido manualmente' })
  importar(@Body(new ZodValidationPipe(PedidoImportSchema)) body: PedidoImport) {
    return this.atendimento.importar(body);
  }
}
