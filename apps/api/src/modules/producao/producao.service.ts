import { Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import type { JobCreate } from '@mahou-hub/contracts';
import type { Prisma } from '@prisma/client';
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
    return this.prisma.jobProducao.create({ data: this.paraJobData(data) });
  }

  /** Cria uma leva: cada item vira um job/card próprio na fila (não é 1 job com N produtos). */
  async createMany(itens: JobCreate[]) {
    const { count } = await this.prisma.jobProducao.createMany({
      data: itens.map((item) => this.paraJobData(item)),
    });
    return { count };
  }

  private paraJobData(data: JobCreate): Prisma.JobProducaoCreateManyInput {
    return {
      dataInicio: new Date(data.dataInicio),
      origem: data.origem,
      produtoId: data.produtoId,
      qtd: data.qtd,
      prioridade: data.prioridade,
      impressora: data.impressora,
      observacao: data.observacao,
    };
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

  /**
   * Exclui um job. Se a baixa de filamento já tinha sido registrada (o job passou por
   * "Impresso"), ESTORNA o consumo — devolve o filamento ao estoque — antes de apagar.
   * Sem isso o filamento ficava descontado pra sempre por um job que nem existe mais.
   * Entrada de estoque nunca fica negativa, então não precisa de `permitirNegativo`.
   */
  async remove(id: string) {
    const job = await this.prisma.jobProducao.findUnique({
      where: { id },
      include: { produto: { select: { nome: true, pesoG: true, filamentoId: true } } },
    });
    if (!job) throw new NotFoundException(`Job ${id} não existe`);

    const gramas = job.consumoRegistrado ? Math.round(Number(job.produto.pesoG) * job.qtd) : 0;
    if (gramas > 0) {
      await this.estoque.registrarMovimento({
        tipoItem: 'FILAMENTO',
        filamentoId: job.produto.filamentoId,
        quantidade: gramas, // positivo: devolve ao estoque o que a impressão tinha baixado
        motivo: 'PRODUCAO',
        observacao: `Estorno (job excluído): ${job.produto.nome} x${job.qtd}`,
      });
    }

    await this.prisma.jobProducao.delete({ where: { id } });
    return { ok: true, estornado: gramas > 0, gramas };
  }
}
