import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SyncOrigem } from '@prisma/client';
import type {
  ConcorrenteCreate,
  ConcorrenteUpdate,
} from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopeeAffiliateService } from './shopee-affiliate.service';
import type { AffiliateProductNode } from './shopee/queries';

@Injectable()
export class ConcorrentesService {
  private readonly log = new Logger(ConcorrentesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopee: ShopeeAffiliateService,
  ) {}

  async list() {
    const concorrentes = await this.prisma.concorrente.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        snapshots: {
          orderBy: { sincronizadoEm: 'desc' },
          take: 1,
          select: { sincronizadoEm: true, qtdProdutos: true, erroMensagem: true, origem: true },
        },
      },
    });
    return concorrentes.map((c) => this.toDto(c, c.snapshots[0]));
  }

  async get(id: string) {
    const c = await this.prisma.concorrente.findUnique({
      where: { id },
      include: {
        snapshots: {
          orderBy: { sincronizadoEm: 'desc' },
          take: 1,
          select: { sincronizadoEm: true, qtdProdutos: true, erroMensagem: true, origem: true },
        },
      },
    });
    if (!c) throw new NotFoundException(`Concorrente ${id} não existe`);
    return this.toDto(c, c.snapshots[0]);
  }

  async listSnapshots(id: string) {
    await this.assertExists(id);
    return this.prisma.concorrenteSnapshot.findMany({
      where: { concorrenteId: id },
      orderBy: { sincronizadoEm: 'desc' },
      select: { id: true, sincronizadoEm: true, origem: true, qtdProdutos: true, erroMensagem: true, criadoEm: true },
    });
  }

  async getSnapshot(concorrenteId: string, snapshotId: string) {
    const snap = await this.prisma.concorrenteSnapshot.findFirst({
      where: { id: snapshotId, concorrenteId },
      include: { produtos: { orderBy: { sales: 'desc' } } },
    });
    if (!snap) throw new NotFoundException(`Snapshot ${snapshotId} não existe pra concorrente ${concorrenteId}`);
    return {
      ...snap,
      produtos: snap.produtos.map((p) => ({
        ...p,
        itemId: p.itemId.toString(),
        commissionRate: p.commissionRate.toString(),
        ratingStar: p.ratingStar?.toString() ?? null,
      })),
    };
  }

  async create(data: ConcorrenteCreate) {
    return this.prisma.concorrente.create({
      data: {
        loja: data.loja,
        instagram: data.instagram ?? null,
        website: data.website ?? null,
        observacao: data.observacao ?? null,
      },
    });
  }

  async createFromLink(url: string) {
    const { shopId, detail } = await this.shopee.resolveShopFromUrl(url);
    const existente = await this.prisma.concorrente.findUnique({ where: { shopId: BigInt(shopId) } });
    if (existente) {
      // Já existe — só faz sync atualizado.
      await this.syncFromShopee(existente.id, SyncOrigem.MANUAL);
      return this.get(existente.id);
    }
    const created = await this.prisma.concorrente.create({
      data: {
        loja: detail.name,
        shopId: BigInt(shopId),
        username: detail.account?.username ?? null,
        urlOriginal: url,
      },
    });
    await this.syncFromShopee(created.id, SyncOrigem.MANUAL);
    return this.get(created.id);
  }

  // Linka um Concorrente existente (cadastro manual) a uma loja Shopee.
  // Reutilizado pelo backfill em massa (script) e pelo botão "Linkar Shopee" na UI.
  async linkShopee(id: string, url: string) {
    const concorrente = await this.prisma.concorrente.findUnique({ where: { id }, select: { id: true, loja: true } });
    if (!concorrente) throw new NotFoundException(`Concorrente ${id} não existe`);
    const { shopId, detail } = await this.shopee.resolveShopFromUrl(url);
    // Garante que esse shopId ainda não foi vinculado a outro concorrente — o UNIQUE
    // do schema também protegeria, mas aqui devolvemos mensagem útil em vez de 500.
    const conflito = await this.prisma.concorrente.findUnique({ where: { shopId: BigInt(shopId) }, select: { id: true, loja: true } });
    if (conflito && conflito.id !== id) {
      throw new ConflictException(`shopId ${shopId} já está vinculado ao concorrente "${conflito.loja}"`);
    }
    await this.prisma.concorrente.update({
      where: { id },
      data: {
        shopId: BigInt(shopId),
        username: detail.account?.username ?? null,
        urlOriginal: url,
      },
    });
    await this.syncFromShopee(id, SyncOrigem.MANUAL);
    return this.get(id);
  }

  async update(id: string, data: ConcorrenteUpdate) {
    await this.assertExists(id);
    return this.prisma.concorrente.update({
      where: { id },
      data: {
        ...(data.loja !== undefined ? { loja: data.loja } : {}),
        ...(data.instagram !== undefined ? { instagram: data.instagram } : {}),
        ...(data.website !== undefined ? { website: data.website } : {}),
        ...(data.observacao !== undefined ? { observacao: data.observacao } : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.concorrente.delete({ where: { id } });
  }

  async removeMuitos(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.concorrente.deleteMany({ where: { id: { in: ids } } });
    return { count: result.count };
  }

  /**
   * Roda o sync de uma loja já cadastrada via Affiliate API.
   * Cria uma linha em ConcorrenteSnapshot (mesmo se falhar, com erroMensagem).
   * Atualiza Concorrente.ultimoSyncEm + campos snapshotados.
   */
  async syncFromShopee(id: string, origem: SyncOrigem) {
    const concorrente = await this.prisma.concorrente.findUnique({ where: { id } });
    if (!concorrente) throw new NotFoundException(`Concorrente ${id} não existe`);
    if (!concorrente.shopId) {
      throw new Error(`Concorrente ${id} não tem shopId — só cadastros via link sincronizam`);
    }
    const shopId = Number(concorrente.shopId);
    try {
      const [shop, produtos] = await Promise.all([
        this.shopee.fetchShop(shopId),
        this.shopee.fetchAllProducts(shopId),
      ]);
      return await this.prisma.$transaction(async (tx) => {
        const snapshot = await tx.concorrenteSnapshot.create({
          data: { concorrenteId: id, origem, qtdProdutos: produtos.length },
        });
        if (produtos.length > 0) {
          await tx.concorrenteSnapshotProduto.createMany({
            data: produtos.map((p) => this.produtoParaInsert(snapshot.id, p)),
          });
        }
        await tx.concorrente.update({
          where: { id },
          data: {
            ultimoSyncEm: snapshot.sincronizadoEm,
            ...(shop
              ? {
                  loja: shop.shopName,
                  imageUrl: shop.imageUrl,
                  ratingStar: new Prisma.Decimal(shop.ratingStar),
                  commissionRatePadrao: new Prisma.Decimal(shop.commissionRate),
                  sellerCommCoveRatio: new Prisma.Decimal(shop.sellerCommCoveRatio),
                }
              : {}),
          },
        });
        this.log.log(`Concorrente ${id} (shopId=${shopId}) sincronizada: ${produtos.length} produtos`);
        return snapshot;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`Falha no sync de Concorrente ${id} (shopId=${shopId}): ${msg}`);
      const snapshot = await this.prisma.concorrenteSnapshot.create({
        data: { concorrenteId: id, origem, qtdProdutos: 0, erroMensagem: msg.slice(0, 1000) },
      });
      return snapshot;
    }
  }

  private produtoParaInsert(
    snapshotId: string,
    p: AffiliateProductNode,
  ): Prisma.ConcorrenteSnapshotProdutoCreateManyInput {
    return {
      snapshotId,
      itemId: BigInt(p.itemId),
      productName: p.productName,
      priceMinCentavos: Math.round(Number(p.priceMin) * 100),
      priceMaxCentavos: Math.round(Number(p.priceMax) * 100),
      priceDiscountRate: Math.trunc(Number(p.priceDiscountRate ?? 0)),
      sales: Math.trunc(Number(p.sales ?? 0)),
      commissionRate: new Prisma.Decimal(p.commissionRate),
      commissionCentavos: Math.round(Number(p.commission) * 100),
      imageUrl: p.imageUrl,
      productLink: p.productLink,
      offerLink: p.offerLink,
      productCatIds: (p.productCatIds ?? []).map((n) => Math.trunc(Number(n))),
      shopType: (p.shopType ?? []).map((n) => Math.trunc(Number(n))),
      ratingStar: p.ratingStar != null ? new Prisma.Decimal(p.ratingStar) : null,
      periodStartTime: new Date(Number(p.periodStartTime) * 1000),
      periodEndTime: new Date(Number(p.periodEndTime) * 1000),
    };
  }

  private async assertExists(id: string): Promise<void> {
    const c = await this.prisma.concorrente.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException(`Concorrente ${id} não existe`);
  }

  private toDto(
    c: Prisma.ConcorrenteGetPayload<Record<string, never>>,
    ultimoSnap?: { sincronizadoEm: Date; qtdProdutos: number; erroMensagem: string | null; origem: SyncOrigem },
  ) {
    return {
      ...c,
      shopId: c.shopId ? c.shopId.toString() : null,
      ratingStar: c.ratingStar?.toString() ?? null,
      commissionRatePadrao: c.commissionRatePadrao?.toString() ?? null,
      sellerCommCoveRatio: c.sellerCommCoveRatio?.toString() ?? null,
      ultimoSnapshot: ultimoSnap ?? null,
    };
  }
}
