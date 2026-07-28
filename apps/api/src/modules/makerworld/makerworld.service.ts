import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  MakerworldBulkImport,
  MakerworldListar,
  MakerworldUpdate,
  ModeloMakerWorldStatus,
} from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

const ORDENACOES: Record<
  MakerworldListar['ordenarPor'],
  Prisma.ModeloMakerWorldOrderByWithRelationInput[]
> = {
  notaIa: [{ notaIa: 'desc' }, { lucroPorHoraCentavos: 'desc' }],
  scoreObjetivo: [{ scoreObjetivo: 'desc' }],
  lucroPorHora: [{ lucroPorHoraCentavos: 'desc' }],
  downloads: [{ downloads: 'desc' }],
};

@Injectable()
export class MakerworldService {
  private readonly logger = new Logger(MakerworldService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert em lote vindo do bot. Chave é `externalId` — reimportar o mesmo modelo
   * atualiza métricas e nota sem duplicar.
   *
   * `status` e `observacao` NÃO são tocados no update: são a revisão do Gabriel, e uma
   * reimportação não pode desfazer um DESCARTADO que ele já decidiu.
   */
  async importarEmLote(payload: MakerworldBulkImport) {
    let criados = 0;
    let atualizados = 0;

    for (const modelo of payload.modelos) {
      const dados = {
        titulo: modelo.titulo,
        url: modelo.url,
        autor: modelo.autor,
        imagemUrl: modelo.imagemUrl,
        downloads: modelo.downloads,
        curtidas: modelo.curtidas,
        colecoes: modelo.colecoes,
        licenca: modelo.licenca,
        licencaVeredicto: modelo.licencaVeredicto,
        licencaObrigacao: modelo.licencaObrigacao,
        nicho: modelo.nicho,
        pesoGramas: new Prisma.Decimal(modelo.pesoGramas),
        tempoHoras: new Prisma.Decimal(modelo.tempoHoras),
        unidadesPorKit: modelo.unidadesPorKit,
        custoEstimadoCentavos: modelo.custoEstimadoCentavos,
        precoSugeridoCentavos: modelo.precoSugeridoCentavos,
        margemEstimadaPct: new Prisma.Decimal(modelo.margemEstimadaPct),
        lucroPorHoraCentavos: modelo.lucroPorHoraCentavos,
        scoreObjetivo: modelo.scoreObjetivo,
        notaIa: modelo.notaIa,
        veredictoIa: modelo.veredictoIa,
        justificativaIa: modelo.justificativaIa,
        alertas: modelo.alertas,
        tags: modelo.tags,
        temFotoReal: modelo.temFotoReal,
      };

      const existente = await this.prisma.modeloMakerWorld.findUnique({
        where: { externalId: modelo.externalId },
        select: { id: true },
      });

      await this.prisma.modeloMakerWorld.upsert({
        where: { externalId: modelo.externalId },
        create: { externalId: modelo.externalId, ...dados },
        update: dados,
      });

      if (existente) atualizados++;
      else criados++;
    }

    this.logger.log(`Importação MakerWorld: ${criados} criados, ${atualizados} atualizados`);
    return { criados, atualizados, total: payload.modelos.length };
  }

  async listar(filtros: MakerworldListar) {
    const where: Prisma.ModeloMakerWorldWhereInput = {};

    if (filtros.status) where.status = filtros.status;
    if (filtros.nicho) where.nicho = filtros.nicho;
    if (filtros.veredictoIa) where.veredictoIa = filtros.veredictoIa;
    if (filtros.notaMinima !== undefined) where.notaIa = { gte: filtros.notaMinima };
    if (filtros.lucroPorHoraMinimoCentavos !== undefined) {
      where.lucroPorHoraCentavos = { gte: filtros.lucroPorHoraMinimoCentavos };
    }
    if (filtros.semAlertas?.length) {
      where.NOT = { alertas: { hasSome: filtros.semAlertas } };
    }
    if (filtros.q) {
      where.OR = [
        { titulo: { contains: filtros.q, mode: 'insensitive' } },
        { tags: { has: filtros.q.toLowerCase() } },
        { autor: { contains: filtros.q, mode: 'insensitive' } },
      ];
    }

    const [itens, total] = await Promise.all([
      this.prisma.modeloMakerWorld.findMany({
        where,
        orderBy: ORDENACOES[filtros.ordenarPor],
        take: filtros.limit,
        skip: filtros.offset,
      }),
      this.prisma.modeloMakerWorld.count({ where }),
    ]);

    return { itens, total, limit: filtros.limit, offset: filtros.offset };
  }

  async buscarPorId(id: string) {
    const modelo = await this.prisma.modeloMakerWorld.findUnique({ where: { id } });
    if (!modelo) throw new NotFoundException(`Modelo MakerWorld ${id} não encontrado`);
    return modelo;
  }

  async atualizar(id: string, dados: MakerworldUpdate) {
    await this.buscarPorId(id);
    return this.prisma.modeloMakerWorld.update({ where: { id }, data: dados });
  }

  async mudarStatusEmLote(ids: string[], status: ModeloMakerWorldStatus) {
    const { count } = await this.prisma.modeloMakerWorld.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    return { atualizados: count };
  }

  /** Contagem por nicho e por status — alimenta os cards da tela de revisão. */
  async resumo() {
    const [porNicho, porStatus, total] = await Promise.all([
      this.prisma.modeloMakerWorld.groupBy({
        by: ['nicho'],
        _count: { _all: true },
        _avg: { notaIa: true },
        orderBy: { _count: { nicho: 'desc' } },
      }),
      this.prisma.modeloMakerWorld.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.modeloMakerWorld.count(),
    ]);

    return {
      total,
      porNicho: porNicho.map((n) => ({
        nicho: n.nicho,
        quantidade: n._count._all,
        notaMedia: Math.round(n._avg.notaIa ?? 0),
      })),
      porStatus: porStatus.map((s) => ({ status: s.status, quantidade: s._count._all })),
    };
  }
}
