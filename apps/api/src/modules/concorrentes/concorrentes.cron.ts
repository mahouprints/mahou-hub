import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SyncOrigem } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConcorrentesService } from './concorrentes.service';

@Injectable()
export class ConcorrentesCron {
  private readonly log = new Logger(ConcorrentesCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: ConcorrentesService,
  ) {}

  // Domingo 03:00 (America/Sao_Paulo). Sincroniza todas as lojas que têm shopId.
  // Roda sequencial pra não estourar quota da Affiliate.
  @Cron('0 3 * * 0', { timeZone: 'America/Sao_Paulo' })
  async syncTodas(): Promise<void> {
    const lojas = await this.prisma.concorrente.findMany({
      where: { shopId: { not: null } },
      select: { id: true, loja: true, shopId: true },
    });
    if (lojas.length === 0) {
      this.log.log('Cron concorrentes: nenhuma loja com shopId pra sincronizar');
      return;
    }
    this.log.log(`Cron concorrentes: iniciando sync de ${lojas.length} loja(s)`);
    let ok = 0;
    let falhou = 0;
    for (const l of lojas) {
      try {
        await this.service.syncFromShopee(l.id, SyncOrigem.CRON);
        ok++;
      } catch (err) {
        falhou++;
        this.log.error(`Cron: ${l.loja} (shopId=${l.shopId}) falhou: ${err instanceof Error ? err.message : err}`);
      }
    }
    this.log.log(`Cron concorrentes: ok=${ok}, falhou=${falhou}`);
  }
}
