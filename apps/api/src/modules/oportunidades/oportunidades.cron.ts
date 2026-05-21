import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopeeProvider } from './providers/shopee.provider';
import { OportunidadesService } from './oportunidades.service';

/**
 * Cron de descoberta baseline. Roda 1h depois do sync de concorrentes (domingo 03h)
 * pra varrer os snapshots novos e materializar candidatos óbvios no backlog.
 *
 * Não chama LLM — só aplica filtros baseline. A análise/scoring fica pro Claude (sob demanda).
 */
@Injectable()
export class OportunidadesCron {
  private readonly log = new Logger(OportunidadesCron.name);

  // Filtros baseline pra evitar entupir o backlog com produtos sem demanda nem margem.
  // Ajustar com base em sinal real depois de algumas semanas.
  private static readonly BASELINE = {
    vendasMin: 100,
    precoMinCentavos: 1500, // R$15
    precoMaxCentavos: 20000, // R$200
    ratingMin: 4.0,
    limit: 500,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopee: ShopeeProvider,
    private readonly oportunidades: OportunidadesService,
  ) {}

  @Cron('0 4 * * 0', { timeZone: 'America/Sao_Paulo' })
  async descobrirNoveProdutos(): Promise<{ criadas: number; vistos: number }> {
    this.log.log('Cron oportunidades: descoberta baseline iniciada');
    const candidatos = await this.shopee.listFromMonitored(OportunidadesCron.BASELINE);
    if (candidatos.length === 0) {
      this.log.log('Cron oportunidades: nenhum candidato passou nos filtros baseline');
      return { criadas: 0, vistos: 0 };
    }

    // Filtra os que já estão no backlog (qualquer status) — não criamos duplicata,
    // o upsert do create resolveria mas atualizaria dados frescos. Pro cron baseline
    // queremos só MATERIALIZAR NOVOS, não refrescar — Claude faz isso sob demanda.
    const externalIds = candidatos.map((c) => c.externalId);
    const existentes = await this.prisma.produtoOportunidade.findMany({
      where: { marketplace: 'SHOPEE', externalId: { in: externalIds } },
      select: { externalId: true },
    });
    const jaExistem = new Set(existentes.map((e) => e.externalId));
    const novos = candidatos.filter((c) => !jaExistem.has(c.externalId));

    if (novos.length === 0) {
      this.log.log(`Cron oportunidades: ${candidatos.length} vistos, 0 novos`);
      return { criadas: 0, vistos: candidatos.length };
    }

    await this.oportunidades.createBulk({
      itens: novos.map((c) => ({
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

    this.log.log(`Cron oportunidades: ${candidatos.length} vistos, ${novos.length} criados`);
    return { criadas: novos.length, vistos: candidatos.length };
  }
}
