import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  OportunidadeBulkCreate,
  OportunidadeCreate,
  OportunidadeFonte,
  OportunidadeMarketplace,
  OportunidadeStatus,
  OportunidadeUpdate,
  OportunidadeVirarProduto,
} from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { OportunidadeLogService } from './oportunidade-log.service';

type ListFiltros = {
  status?: OportunidadeStatus;
  scoreMin?: number;
  fonte?: OportunidadeFonte;
  marketplace?: OportunidadeMarketplace;
  q?: string;
  take?: number;
  skip?: number;
};

@Injectable()
export class OportunidadesService {
  private readonly log = new Logger(OportunidadesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: OportunidadeLogService,
  ) {}

  async list(filtros: ListFiltros) {
    const where: Prisma.ProdutoOportunidadeWhereInput = {
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.fonte ? { fonte: filtros.fonte } : {}),
      ...(filtros.marketplace ? { marketplace: filtros.marketplace } : {}),
      ...(filtros.scoreMin != null
        ? { score: { gte: new Prisma.Decimal(filtros.scoreMin) } }
        : {}),
      ...(filtros.q
        ? { productName: { contains: filtros.q, mode: 'insensitive' as const } }
        : {}),
    };
    const items = await this.prisma.produtoOportunidade.findMany({
      where,
      orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { criadoEm: 'desc' }],
      take: filtros.take ?? 100,
      skip: filtros.skip ?? 0,
    });
    return items.map((o) => this.toDto(o));
  }

  async get(id: string) {
    const o = await this.prisma.produtoOportunidade.findUnique({ where: { id } });
    if (!o) throw new NotFoundException(`Oportunidade ${id} não existe`);
    return this.toDto(o);
  }

  // Upsert por (marketplace, externalId). Permite re-salvar com dados frescos.
  // Loga só quando É novo (create path); update silencioso pra não inflar com refresh de mercado.
  async create(data: OportunidadeCreate, usuarioId: string | null = null) {
    const existente = await this.prisma.produtoOportunidade.findUnique({
      where: {
        marketplace_externalId: { marketplace: data.marketplace, externalId: data.externalId },
      },
      select: { id: true, status: true, score: true, notas: true },
    });
    const o = await this.prisma.produtoOportunidade.upsert({
      where: {
        marketplace_externalId: { marketplace: data.marketplace, externalId: data.externalId },
      },
      create: this.toPersist(data),
      update: this.toPersistUpdate(data),
    });
    if (!existente) {
      await this.audit.logCreated(
        o.id,
        {
          fonte: o.fonte,
          status: o.status,
          score: o.score != null ? Number(o.score) : null,
          marketplace: o.marketplace,
        },
        usuarioId,
      );
    } else {
      // upsert pode ter mexido em status/score/notas (se vieram no payload). Loga diff.
      await this.logDiff(existente, o, usuarioId);
    }
    return this.toDto(o);
  }

  // Bulk não gera log por item (200 logs num batch é poluição). Loga 1 evento agregado
  // por marketplace+fonte+status, ou ignora se vier sem usuarioId (cron).
  async createBulk(data: OportunidadeBulkCreate, usuarioId: string | null = null) {
    // Pra saber quais são novos, conferimos os externalIds existentes primeiro.
    const externalIds = data.itens.map((i) => i.externalId);
    const existentes = await this.prisma.produtoOportunidade.findMany({
      where: { externalId: { in: externalIds } },
      select: { id: true, externalId: true, marketplace: true },
    });
    const jaExiste = new Set(existentes.map((e) => `${e.marketplace}:${e.externalId}`));

    const results = await this.prisma.$transaction(
      data.itens.map((item) =>
        this.prisma.produtoOportunidade.upsert({
          where: {
            marketplace_externalId: { marketplace: item.marketplace, externalId: item.externalId },
          },
          create: this.toPersist(item),
          update: this.toPersistUpdate(item),
        }),
      ),
    );

    // Loga só os realmente novos.
    const novos = results.filter((r) => !jaExiste.has(`${r.marketplace}:${r.externalId}`));
    for (const o of novos) {
      await this.audit.logCreated(
        o.id,
        {
          fonte: o.fonte,
          status: o.status,
          score: o.score != null ? Number(o.score) : null,
          marketplace: o.marketplace,
        },
        usuarioId,
      );
    }
    return { count: results.length, ids: results.map((r) => r.id), novos: novos.length };
  }

  async update(id: string, data: OportunidadeUpdate, usuarioId: string | null = null) {
    const antes = await this.prisma.produtoOportunidade.findUnique({
      where: { id },
      select: { id: true, status: true, score: true, notas: true },
    });
    if (!antes) throw new NotFoundException(`Oportunidade ${id} não existe`);
    const o = await this.prisma.produtoOportunidade.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.score !== undefined
          ? { score: data.score == null ? null : new Prisma.Decimal(data.score) }
          : {}),
        ...(data.notas !== undefined ? { notas: data.notas } : {}),
      },
    });
    await this.logDiff(antes, o, usuarioId);
    return this.toDto(o);
  }

  private async logDiff(
    antes: { id: string; status: string; score: Prisma.Decimal | null; notas: string | null },
    depois: { id: string; status: string; score: Prisma.Decimal | null; notas: string | null },
    usuarioId: string | null,
  ) {
    await this.audit.logStatusChange(antes.id, antes.status, depois.status, usuarioId);
    await this.audit.logScoreChange(
      antes.id,
      antes.score != null ? Number(antes.score) : null,
      depois.score != null ? Number(depois.score) : null,
      usuarioId,
    );
    await this.audit.logNotasChange(antes.id, antes.notas, depois.notas, usuarioId);
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);
    await this.prisma.produtoOportunidade.delete({ where: { id } });
  }

  async removeMuitos(ids: string[]): Promise<{ count: number }> {
    const result = await this.prisma.produtoOportunidade.deleteMany({
      where: { id: { in: ids } },
    });
    return { count: result.count };
  }

  // Promove candidato a Produto. Se todos os campos críticos (filamento/peso/tempo/impressora)
  // vierem preenchidos, cria produto completo. Caso contrário, cria como `rascunho=true,
  // ativo=false` com defaults zerados — usuário completa pela UI antes de anunciar.
  async virarProduto(
    id: string,
    payload: OportunidadeVirarProduto,
    usuarioId: string | null = null,
  ) {
    const oportunidade = await this.prisma.produtoOportunidade.findUnique({ where: { id } });
    if (!oportunidade) throw new NotFoundException(`Oportunidade ${id} não existe`);
    if (oportunidade.produtoId) {
      throw new ConflictException(
        `Oportunidade ${id} já virou produto (${oportunidade.produtoId})`,
      );
    }

    const completo =
      payload.filamentoId != null &&
      payload.pesoG != null &&
      payload.tempoH != null &&
      payload.impressora != null;

    // Resolve filamento: o passado pelo usuário OU o primeiro ativo como fallback de rascunho.
    let filamentoId = payload.filamentoId;
    if (filamentoId) {
      const exists = await this.prisma.filamento.findUnique({
        where: { id: filamentoId },
        select: { id: true },
      });
      if (!exists) throw new BadRequestException(`Filamento ${filamentoId} não existe`);
    } else {
      const fallback = await this.prisma.filamento.findFirst({
        where: { ativo: true },
        select: { id: true },
        orderBy: { criadoEm: 'asc' },
      });
      if (!fallback) {
        throw new BadRequestException(
          'Nenhum filamento ativo cadastrado — cadastre um antes de criar rascunhos',
        );
      }
      filamentoId = fallback.id;
    }

    const nome = payload.nome ?? oportunidade.productName.slice(0, 200);
    const precoCentavos =
      payload.precoCentavos ??
      Math.round((oportunidade.priceMinCentavos + oportunidade.priceMaxCentavos) / 2);
    const canalPrincipal = this.marketplaceToCanal(oportunidade.marketplace);

    return this.prisma.$transaction(async (tx) => {
      const produto = await tx.produto.create({
        data: {
          nome,
          inspiracao: oportunidade.productLink,
          filamentoId,
          pesoG: new Prisma.Decimal(payload.pesoG ?? 0),
          tempoH: new Prisma.Decimal(payload.tempoH ?? 0),
          impressora: payload.impressora ?? 'A1',
          embalagemCentavos: payload.embalagemCentavos ?? 0,
          precoCentavos,
          canalPrincipal,
          rascunho: !completo,
          ativo: completo,
        },
      });
      await tx.produtoOportunidade.update({
        where: { id },
        data: { status: 'VIRARAM_PRODUTO', produtoId: produto.id },
      });
      this.log.log(
        `Oportunidade ${id} (${oportunidade.marketplace}:${oportunidade.externalId}) virou ` +
          `Produto ${produto.id} (${completo ? 'completo' : 'rascunho'})`,
      );
      // Audit fora da transação (não precisa ser atômico — log pode falhar sem rollback).
      void this.audit.logVirouProduto(id, produto.id, usuarioId);
      void this.audit.logStatusChange(id, oportunidade.status, 'VIRARAM_PRODUTO', usuarioId);
      return produto;
    });
  }

  async historico(id: string) {
    await this.assertExists(id);
    return this.audit.list(id);
  }

  async estatisticas() {
    // Prisma 5 exige orderBy no groupBy; ordenação não importa aqui, agrupamos depois.
    const [porStatus, porFonte, porMarketplace, total] = await this.prisma.$transaction([
      this.prisma.produtoOportunidade.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.produtoOportunidade.groupBy({
        by: ['fonte'],
        _count: { _all: true },
        orderBy: { fonte: 'asc' },
      }),
      this.prisma.produtoOportunidade.groupBy({
        by: ['marketplace'],
        _count: { _all: true },
        orderBy: { marketplace: 'asc' },
      }),
      this.prisma.produtoOportunidade.count(),
    ]);
    return {
      total,
      porStatus: Object.fromEntries(porStatus.map((r) => [r.status, this.extractAll(r._count)])),
      porFonte: Object.fromEntries(porFonte.map((r) => [r.fonte, this.extractAll(r._count)])),
      porMarketplace: Object.fromEntries(
        porMarketplace.map((r) => [r.marketplace, this.extractAll(r._count)]),
      ),
    };
  }

  // groupBy tipa `_count` como `true | { _all?: number; ... }` quando se passa `_all: true`.
  // Narrowing manual pra extrair só o número.
  private extractAll(count: unknown): number {
    if (typeof count === 'object' && count !== null && '_all' in count) {
      const v = (count as { _all?: number })._all;
      return typeof v === 'number' ? v : 0;
    }
    return 0;
  }

  private async assertExists(id: string): Promise<void> {
    const o = await this.prisma.produtoOportunidade.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!o) throw new NotFoundException(`Oportunidade ${id} não existe`);
  }

  private toPersist(data: OportunidadeCreate): Prisma.ProdutoOportunidadeCreateInput {
    const base: Prisma.ProdutoOportunidadeCreateInput = {
      marketplace: data.marketplace,
      externalId: data.externalId,
      productName: data.productName,
      priceMinCentavos: data.priceMinCentavos,
      priceMaxCentavos: data.priceMaxCentavos,
      imageUrl: data.imageUrl,
      productLink: data.productLink,
      vendasEstimadasMes: data.vendasEstimadasMes,
      ratingStar: data.ratingStar != null ? new Prisma.Decimal(data.ratingStar) : null,
      categoriaIds: data.categoriaIds ?? [],
      lojaExternalId: data.lojaExternalId ?? null,
      lojaNome: data.lojaNome ?? null,
      fonte: data.fonte,
      fonteParam: data.fonteParam ?? null,
      status: data.status ?? 'NOVO',
      score: data.score != null ? new Prisma.Decimal(data.score) : null,
      notas: data.notas ?? null,
    };
    if (data.concorrenteId) {
      base.concorrente = { connect: { id: data.concorrenteId } };
    }
    if (data.snapshotProdutoId) {
      base.snapshotProduto = { connect: { id: data.snapshotProdutoId } };
    }
    return base;
  }

  // Update do upsert: refresca dados de mercado (preço, vendas, rating) mas preserva
  // workflow (status, score, notas) — usuário/Claude já tomou decisões sobre essa oportunidade.
  private toPersistUpdate(data: OportunidadeCreate): Prisma.ProdutoOportunidadeUpdateInput {
    return {
      productName: data.productName,
      priceMinCentavos: data.priceMinCentavos,
      priceMaxCentavos: data.priceMaxCentavos,
      imageUrl: data.imageUrl,
      productLink: data.productLink,
      vendasEstimadasMes: data.vendasEstimadasMes,
      ratingStar: data.ratingStar != null ? new Prisma.Decimal(data.ratingStar) : null,
      categoriaIds: data.categoriaIds ?? [],
      lojaExternalId: data.lojaExternalId ?? null,
      lojaNome: data.lojaNome ?? null,
      // fonte/fonteParam só atualizam se vierem; status/score/notas só se explicitamente passados.
      ...(data.fonteParam !== undefined ? { fonteParam: data.fonteParam } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.score !== undefined
        ? { score: data.score == null ? null : new Prisma.Decimal(data.score) }
        : {}),
      ...(data.notas !== undefined ? { notas: data.notas } : {}),
    };
  }

  private marketplaceToCanal(marketplace: OportunidadeMarketplace) {
    switch (marketplace) {
      case 'SHOPEE':
        return 'SHOPEE' as const;
      case 'TIKTOK':
        return 'TIKTOK' as const;
      case 'ML':
        return 'ML' as const;
      default:
        return 'SITE' as const;
    }
  }

  private toDto(o: Prisma.ProdutoOportunidadeGetPayload<Record<string, never>>) {
    return {
      ...o,
      ratingStar: o.ratingStar?.toString() ?? null,
      score: o.score?.toString() ?? null,
    };
  }
}
