import { Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import type { JobCreate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';

@Injectable()
export class ProducaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
  ) {}

  /** Lista os jobs pro kanban, já com nome do produto, filamento e consumo estimado. */
  async list() {
    const jobs = await this.prisma.jobProducao.findMany({
      orderBy: [{ prioridade: 'desc' }, { dataInicio: 'asc' }],
      include: {
        produto: {
          select: { nome: true, pesoG: true, filamento: { select: { nome: true } } },
        },
      },
    });
    return jobs.map((j) => ({
      id: j.id,
      status: j.status,
      origem: j.origem,
      qtd: j.qtd,
      prioridade: j.prioridade,
      impressora: j.impressora,
      observacao: j.observacao,
      consumoRegistrado: j.consumoRegistrado,
      dataInicio: j.dataInicio,
      dataFim: j.dataFim,
      produtoId: j.produtoId,
      produtoNome: j.produto.nome,
      filamentoNome: j.produto.filamento.nome,
      consumoGramas: Math.round(Number(j.produto.pesoG) * j.qtd),
    }));
  }

  create(data: JobCreate) {
    return this.prisma.jobProducao.create({
      data: {
        dataInicio: new Date(data.dataInicio),
        origem: data.origem,
        produtoId: data.produtoId,
        qtd: data.qtd,
        prioridade: data.prioridade,
        impressora: data.impressora,
        observacao: data.observacao,
      },
    });
  }

  /**
   * Muda o status do job. Ao marcar como CONCLUIDO ("impresso") pela 1ª vez,
   * baixa automaticamente o filamento consumido (peso da peça × qtd) e marca
   * `consumoRegistrado` pra não baixar de novo. Permite saldo negativo de propósito:
   * a impressão já aconteceu, então o registro reflete a realidade mesmo se o
   * estoque cadastrado estava abaixo do consumido (sinaliza divergência a corrigir).
   */
  async mudarStatus(id: string, status: JobStatus) {
    const job = await this.prisma.jobProducao.findUnique({
      where: { id },
      include: { produto: { select: { nome: true, pesoG: true, filamentoId: true } } },
    });
    if (!job) throw new NotFoundException(`Job ${id} não existe`);

    if (status === 'CONCLUIDO' && !job.consumoRegistrado) {
      const gramas = Math.round(Number(job.produto.pesoG) * job.qtd);
      if (gramas > 0) {
        await this.estoque.registrarMovimento(
          {
            tipoItem: 'FILAMENTO',
            filamentoId: job.produto.filamentoId,
            quantidade: -gramas,
            motivo: 'PRODUCAO',
            observacao: `Impressão: ${job.produto.nome} x${job.qtd}`,
          },
          { permitirNegativo: true },
        );
      }
      await this.prisma.jobProducao.update({ where: { id }, data: { consumoRegistrado: true } });
    }

    return this.prisma.jobProducao.update({
      where: { id },
      data: {
        status,
        ...(status === 'CONCLUIDO' && !job.dataFim ? { dataFim: new Date() } : {}),
      },
    });
  }

  async remove(id: string) {
    const job = await this.prisma.jobProducao.findUnique({ where: { id }, select: { id: true } });
    if (!job) throw new NotFoundException(`Job ${id} não existe`);
    await this.prisma.jobProducao.delete({ where: { id } });
    return { ok: true };
  }
}
