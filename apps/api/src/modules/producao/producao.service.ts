import { Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import type { HistoricoPeriodo, JobCreate, ProducaoHistoricoBucket } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import {
  calcularConsumoFilamentos,
  consumoParaEstorno,
  somarConsumoFilamentos,
  type ConsumoFilamento,
} from './consumo-filamentos';

const PRODUTO_CONSUMO_SELECT = {
  nome: true,
  pesoG: true,
  filamentoId: true,
  filamentos: {
    orderBy: { ordem: 'asc' },
    select: { filamentoId: true, pesoG: true },
  },
} satisfies Prisma.ProdutoSelect;
const JOB_CONSUMO_INCLUDE = {
  produto: { select: PRODUTO_CONSUMO_SELECT },
  variacao: { select: { nome: true, filamentoId: true, pesoG: true } },
} satisfies Prisma.JobProducaoInclude;
type JobComConsumo = Prisma.JobProducaoGetPayload<{ include: typeof JOB_CONSUMO_INCLUDE }>;

// generate_series + date_trunc por período. unit/step/offset são literais fixos (sem injeção).
const HISTORICO_CFG: Record<HistoricoPeriodo, { unit: string; step: string; offset: string }> = {
  diario: { unit: 'day', step: '1 day', offset: '29 days' },
  semanal: { unit: 'week', step: '1 week', offset: '11 weeks' },
  mensal: { unit: 'month', step: '1 month', offset: '11 months' },
  anual: { unit: 'year', step: '1 year', offset: '4 years' },
};

@Injectable()
export class ProducaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
  ) {}

  /** Lista os jobs pro kanban, com produto, variação (cor) e consumo estimado. */
  async list() {
    const jobs = await this.prisma.jobProducao.findMany({
      orderBy: [{ prioridade: 'desc' }, { dataInicio: 'asc' }],
      include: {
        produto: {
          select: {
            ...PRODUTO_CONSUMO_SELECT,
            filamento: { select: { nome: true } },
            filamentos: {
              orderBy: { ordem: 'asc' },
              include: { filamento: { select: { nome: true } } },
            },
          },
        },
        variacao: {
          select: {
            nome: true,
            filamentoId: true,
            pesoG: true,
            filamento: { select: { nome: true } },
          },
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
      consumoProdutoRegistrado: j.consumoProdutoRegistrado,
      daEstoque: j.daEstoque,
      dataInicio: j.dataInicio,
      dataFim: j.dataFim,
      produtoId: j.produtoId,
      produtoNome: j.produto.nome,
      variacaoId: j.variacaoId,
      variacaoNome: j.variacao?.nome ?? null,
      filamentoNome:
        j.produto.filamentos.length > 1
          ? j.produto.filamentos.map((item) => item.filamento.nome).join(' + ')
          : (j.variacao?.filamento?.nome ?? j.produto.filamento.nome),
      // Card do estoque pronto não consome filamento: mostra 0.
      consumoGramas: j.daEstoque
        ? 0
        : somarConsumoFilamentos(
            calcularConsumoFilamentos(
              j.produto,
              j.produto.filamentos.length > 1 ? null : j.variacao,
              j.qtd,
            ),
          ),
    }));
  }

  create(data: JobCreate) {
    return this.prisma.jobProducao.create({
      data: {
        dataInicio: new Date(data.dataInicio),
        origem: data.origem,
        produtoId: data.produtoId,
        variacaoId: data.variacaoId ?? null,
        qtd: data.qtd,
        prioridade: data.prioridade,
        impressora: data.impressora,
        observacao: data.observacao,
      },
    });
  }

  /**
   * Cria uma leva. Cada item vira 1+ cards. Quando o item tem variação e existe
   * estoque de peças prontas, parte (ou tudo) "pula impressão": vira card daEstoque
   * já em CONCLUIDO. O resto entra na FILA pra imprimir. NÃO baixa estoque aqui — a
   * baixa de prontos só acontece ao Embalar (mudarStatus).
   */
  async createMany(itens: JobCreate[]) {
    return this.prisma.$transaction(async (tx) => {
      const cards: Prisma.JobProducaoCreateManyInput[] = [];
      for (const item of itens) {
        const variacao = item.variacaoId
          ? await tx.produtoVariacao.findUnique({
              where: { id: item.variacaoId },
              select: { estoqueAtual: true },
            })
          : null;
        cards.push(...this.montarCardsDoItem(item, variacao?.estoqueAtual ?? 0));
      }
      const { count } = await tx.jobProducao.createMany({ data: cards });
      return { count };
    });
  }

  private montarCardsDoItem(
    item: JobCreate,
    estoqueProntos: number,
  ): Prisma.JobProducaoCreateManyInput[] {
    const base = {
      dataInicio: new Date(item.dataInicio),
      origem: item.origem,
      produtoId: item.produtoId,
      variacaoId: item.variacaoId ?? null,
      prioridade: item.prioridade,
      impressora: item.impressora,
      observacao: item.observacao,
    };
    if (!item.variacaoId) {
      return [{ ...base, qtd: item.qtd, status: JobStatus.FILA }];
    }
    // Split: o que já existe em estoque pula impressão; o resto vai imprimir.
    const fromStock = Math.min(item.qtd, Math.max(0, estoqueProntos));
    const toPrint = item.qtd - fromStock;
    const cards: Prisma.JobProducaoCreateManyInput[] = [];
    if (fromStock > 0)
      cards.push({ ...base, qtd: fromStock, daEstoque: true, status: JobStatus.CONCLUIDO });
    if (toPrint > 0) cards.push({ ...base, qtd: toPrint, status: JobStatus.FILA });
    return cards;
  }

  /**
   * Muda o status com efeitos de estoque idempotentes (guardados por flags):
   * - ao "imprimir" (CONCLUIDO+) baixa filamento — exceto cards daEstoque, que NUNCA
   *   consomem filamento (a peça já existia);
   * - ao "embalar" (EMBALADO/ENVIADO) baixa o estoque de prontos dos cards daEstoque;
   * - ao voltar pra antes da embalagem (ou cancelar), estorna o estoque de prontos.
   * Filamento não é estornado ao voltar de CONCLUIDO: a peça foi fisicamente impressa.
   */
  async mudarStatus(id: string, status: JobStatus) {
    // Todas as cores e as flags precisam confirmar juntas. Serializable impede duas
    // conclusões simultâneas de debitarem a mesma impressão mais de uma vez.
    return this.prisma.$transaction(
      async (tx) => {
        const job = await this.carregarJobComConsumo(tx, id);
        const foiImpresso = status === 'CONCLUIDO' || status === 'EMBALADO' || status === 'ENVIADO';
        const consumo = await this.baixarReceita(tx, job, foiImpresso);
        const prontos = await this.movimentarProntos(tx, job, status);
        return tx.jobProducao.update({
          where: { id },
          data: {
            status,
            ...consumo,
            ...prontos,
            ...(foiImpresso && !job.dataFim ? { dataFim: new Date() } : {}),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Exclui um job estornando o que ele já movimentou: filamento (se já imprimiu) e
   * estoque de prontos (se já embalou). Sem isso sobrava baixa órfã de um job inexistente.
   */
  async remove(id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const job = await this.carregarJobComConsumo(tx, id);
        const rotulo = this.rotulo(job.produto.nome, job.variacao?.nome);
        const consumo = job.consumoRegistrado
          ? consumoParaEstorno(job.consumoFilamentos, job.produto, job.variacao, job.qtd)
          : [];
        await this.movimentarReceita(
          tx,
          consumo,
          1,
          `Estorno (job excluído): ${rotulo} x${job.qtd}`,
        );
        const prontosEstornados = job.consumoProdutoRegistrado && job.variacaoId ? job.qtd : 0;
        if (prontosEstornados > 0) {
          await this.ajustarProntos(
            tx,
            job.variacaoId!,
            prontosEstornados,
            'AJUSTE',
            `Estorno (job excluído): ${rotulo} x${job.qtd}`,
          );
        }
        await tx.jobProducao.delete({ where: { id } });
        const gramas = somarConsumoFilamentos(consumo);
        return { ok: true, estornado: gramas > 0, gramas, prontosEstornados };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async carregarJobComConsumo(tx: Prisma.TransactionClient, id: string) {
    const job = await tx.jobProducao.findUnique({ where: { id }, include: JOB_CONSUMO_INCLUDE });
    if (!job) throw new NotFoundException(`Job ${id} não existe`);
    return job;
  }

  private async baixarReceita(
    tx: Prisma.TransactionClient,
    job: JobComConsumo,
    foiImpresso: boolean,
  ): Promise<Prisma.JobProducaoUpdateInput> {
    if (!foiImpresso || job.daEstoque || job.consumoRegistrado) return {};
    const consumo = calcularConsumoFilamentos(job.produto, job.variacao, job.qtd);
    const rotulo = this.rotulo(job.produto.nome, job.variacao?.nome);
    await this.movimentarReceita(tx, consumo, -1, `Impressão: ${rotulo} x${job.qtd}`);
    return { consumoRegistrado: true, consumoFilamentos: consumo };
  }

  private async movimentarProntos(
    tx: Prisma.TransactionClient,
    job: JobComConsumo,
    status: JobStatus,
  ): Promise<Prisma.JobProducaoUpdateInput> {
    if (!job.daEstoque || !job.variacaoId) return {};
    const embalado = status === 'EMBALADO' || status === 'ENVIADO';
    if (embalado === job.consumoProdutoRegistrado) return {};
    const rotulo = this.rotulo(job.produto.nome, job.variacao?.nome);
    await this.ajustarProntos(
      tx,
      job.variacaoId,
      embalado ? -job.qtd : job.qtd,
      embalado ? 'VENDA' : 'AJUSTE',
      `${embalado ? 'Embalado' : 'Estorno (voltou de embalado)'}: ${rotulo} x${job.qtd}`,
    );
    return { consumoProdutoRegistrado: embalado };
  }

  /** Série temporal de peças produzidas (bucketadas por dataFim), pro gráfico de histórico. */
  async historico(periodo: HistoricoPeriodo): Promise<ProducaoHistoricoBucket[]> {
    const cfg = HISTORICO_CFG[periodo];
    const rows = await this.prisma.$queryRaw<{ inicio: Date; total: bigint }[]>(Prisma.sql`
      SELECT gs AS inicio, COALESCE(SUM(j.qtd), 0) AS total
      FROM generate_series(
        date_trunc(${cfg.unit}, now()) - ${cfg.offset}::interval,
        date_trunc(${cfg.unit}, now()),
        ${cfg.step}::interval
      ) AS gs
      LEFT JOIN "JobProducao" j
        ON date_trunc(${cfg.unit}, j."dataFim") = gs
        AND j."dataFim" IS NOT NULL
        AND j."daEstoque" = false
        AND j.status::text <> 'CANCELADO'
      GROUP BY gs
      ORDER BY gs ASC
    `);
    return rows.map((r) => ({ inicio: r.inicio.toISOString(), total: Number(r.total) }));
  }

  private rotulo(produtoNome: string, variacaoNome?: string | null) {
    return variacaoNome ? `${produtoNome} ${variacaoNome}` : produtoNome;
  }

  private async movimentarReceita(
    tx: Prisma.TransactionClient,
    consumo: ConsumoFilamento[],
    sinal: 1 | -1,
    observacao: string,
  ) {
    for (const item of consumo) {
      await this.estoque.registrarEmTransacao(
        tx,
        {
          tipoItem: 'FILAMENTO',
          filamentoId: item.filamentoId,
          quantidade: item.gramas * sinal,
          motivo: 'PRODUCAO',
          observacao,
        },
        { permitirNegativo: true },
      );
    }
  }

  private ajustarProntos(
    tx: Prisma.TransactionClient,
    variacaoId: string,
    quantidade: number,
    motivo: 'VENDA' | 'AJUSTE',
    observacao: string,
  ) {
    return this.estoque.registrarEmTransacao(
      tx,
      { tipoItem: 'PRODUTO', variacaoId, quantidade, motivo, observacao },
      { permitirNegativo: true },
    );
  }
}
