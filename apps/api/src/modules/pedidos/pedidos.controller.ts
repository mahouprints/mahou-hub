import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AtendimentoService, type PedidoImportado } from './atendimento.service';
import { PedidosSyncService } from './pedidos-sync.service';
import { PrismaService } from '../../prisma/prisma.service';

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
  async listar(@Query('status') status?: string, @Query('canal') canal?: string) {
    return this.prisma.pedidoMarketplace.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(canal ? { canal: canal as never } : {}),
      },
      include: {
        itens: {
          include: { variacao: { select: { sku: true, nome: true, estoqueAtual: true } } },
        },
      },
      orderBy: [{ prazoEnvio: 'asc' }, { dataPedido: 'desc' }],
      take: 200,
    });
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

  @Post('sync')
  @ApiOperation({ summary: 'Puxa pedidos novos dos marketplaces configurados' })
  sincronizar(@Query('horas') horas?: string) {
    return this.sync.sincronizarTudo(Number(horas) || 24);
  }

  @Post('itens/:id/vincular')
  @ApiOperation({ summary: 'Liga um item órfão a uma variação e atende na hora' })
  vincular(@Param('id') id: string, @Body() body: { variacaoId: string }) {
    return this.atendimento.vincularItem(id, body.variacaoId);
  }

  /**
   * Importação manual — usada em teste e pra reprocessar um pedido específico
   * sem esperar o cron. O payload é o mesmo formato que os adaptadores produzem.
   */
  @Post('importar')
  @ApiOperation({ summary: '(Admin) Importa um pedido manualmente' })
  importar(@Body() body: PedidoImportado) {
    return this.atendimento.importar({
      ...body,
      dataPedido: new Date(body.dataPedido),
      prazoEnvio: body.prazoEnvio ? new Date(body.prazoEnvio) : null,
    });
  }
}
