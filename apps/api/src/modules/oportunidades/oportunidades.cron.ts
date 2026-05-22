import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopeeProvider } from './providers/shopee.provider';
import { OportunidadesService } from './oportunidades.service';

/**
 * Cron de descoberta baseline. Roda 1h depois do sync de concorrentes (domingo 03h)
 * pra varrer os snapshots novos e materializar candidatos óbvios no backlog.
 *
 * Pega TUDO que passa nos filtros baseline e ainda não está no backlog — divide em
 * batches só pro `createBulk` não estourar o limite de createMany do Postgres.
 * Não chama LLM — scoring/análise fica pro Claude sob demanda.
 */
@Injectable()
export class OportunidadesCron {
  private readonly log = new Logger(OportunidadesCron.name);

  // Filtros baseline pra evitar entupir o backlog com produtos sem demanda nem margem.
  // Ajustar com base em sinal real depois de algumas semanas.
  private static readonly BASELINE_FILTERS = {
    vendasMin: 100,
    precoMinCentavos: 1500, // R$15
    precoMaxCentavos: 20000, // R$200
    ratingMin: 4.0,
  } as const;

  // Tamanho do lote pro createBulk — limite prático do createMany no Postgres com
  // payload típico (~10 colunas + relations) é alto, mas mantemos 500 por segurança.
  private static readonly BATCH_SIZE = 500;

  // Teto de segurança caso o filtro de existentes vaze (não deveria). Em produção
  // o snapshot inteiro tem ~5k produtos, então 50 batches = 25k é folga ampla.
  private static readonly MAX_BATCHES = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopee: ShopeeProvider,
    private readonly oportunidades: OportunidadesService,
  ) {}

  @Cron('0 4 * * 0', { timeZone: 'America/Sao_Paulo' })
  async descobrirNoveProdutos(): Promise<{ criadas: number; vistos: number; batches: number }> {
    this.log.log('Cron oportunidades: descoberta baseline iniciada');
    // Sem cap — queremos TUDO que passa nos filtros baseline. Dedup acontece depois.
    const todos = await this.shopee.listFromMonitored({
      ...OportunidadesCron.BASELINE_FILTERS,
      limit: Number.MAX_SAFE_INTEGER,
    });
    if (todos.length === 0) {
      this.log.log('Cron oportunidades: nenhum candidato passou nos filtros baseline');
      return { criadas: 0, vistos: 0, batches: 0 };
    }

    const externalIds = todos.map((c) => c.externalId);
    const existentes = await this.prisma.produtoOportunidade.findMany({
      where: { marketplace: 'SHOPEE', externalId: { in: externalIds } },
      select: { externalId: true },
    });
    const jaExistem = new Set(existentes.map((e) => e.externalId));
    const novos = todos.filter((c) => !jaExistem.has(c.externalId));

    if (novos.length === 0) {
      this.log.log(`Cron oportunidades: ${todos.length} vistos, 0 novos`);
      return { criadas: 0, vistos: todos.length, batches: 0 };
    }

    let criadas = 0;
    let batches = 0;
    for (let i = 0; i < novos.length && batches < OportunidadesCron.MAX_BATCHES; i += OportunidadesCron.BATCH_SIZE) {
      const lote = novos.slice(i, i + OportunidadesCron.BATCH_SIZE);
      await this.oportunidades.createBulk({
        itens: lote.map((c) => ({
          marketplace: c.marketplace,
          externalId: c.externalId,
          productName: c.productName,
          priceMinCentavos: c.priceMinCentavos,
          priceMaxCentavos: c.priceMaxCentavos,
          imageUrl: c.imageUrl,
          productLink: c.productLink,
          vendasEstimadasMes: c.vendasEstimadasMes,
          ratingStar: c.ratingStar,
          categoriaIds: c.categoriaIds,
          lojaExternalId: c.lojaExternalId,
          lojaNome: c.lojaNome,
          fonte: 'CONCORRENTE',
          fonteParam: null,
          concorrenteId: c.concorrenteId ?? null,
          snapshotProdutoId: c.snapshotProdutoId ?? null,
          status: 'NOVO',
          score: null,
          notas: null,
        })),
      });
      criadas += lote.length;
      batches += 1;
    }

    this.log.log(
      `Cron oportunidades: ${todos.length} vistos, ${criadas} criados em ${batches} batches`,
    );
    return { criadas, vistos: todos.length, batches };
  }
}
