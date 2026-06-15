import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InsumoCreate, InsumoUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InsumosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista insumos. `incluirInativos=false` (padrão) filtra ativo=true —
   * UI normal só vê ativos; tela de admin pode passar true pra ver tudo.
   * Acompanha contagem de produtos que referenciam (pra UI sinalizar uso).
   */
  async list(incluirInativos = false) {
    const where = incluirInativos ? {} : { ativo: true };
    const insumos = await this.prisma.insumo.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: { _count: { select: { produtos: true } } },
    });
    return insumos.map((i) => this.toDto(i));
  }

  async get(id: string) {
    const i = await this.prisma.insumo.findUnique({ where: { id } });
    if (!i) throw new NotFoundException(`Insumo ${id} não existe`);
    return this.toDto(i);
  }

  async create(data: InsumoCreate) {
    return this.toDto(await this.prisma.insumo.create({ data }));
  }

  async update(id: string, data: InsumoUpdate) {
    return this.toDto(await this.prisma.insumo.update({ where: { id }, data }));
  }

  // Decimal (estoque) vira number na borda — UI não recebe string.
  private toDto<T extends { estoqueAtual: Prisma.Decimal; estoqueMinimo: Prisma.Decimal }>(i: T) {
    return { ...i, estoqueAtual: Number(i.estoqueAtual), estoqueMinimo: Number(i.estoqueMinimo) };
  }

  /** Soft-delete: produtos antigos podem referenciar e queremos preservar histórico. */
  async desativar(id: string) {
    await this.prisma.insumo.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  }
}
