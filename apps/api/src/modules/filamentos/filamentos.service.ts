import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FilamentoCreate, FilamentoUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FilamentosService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const filamentos = await this.prisma.filamento.findMany({ orderBy: { nome: 'asc' } });
    return filamentos.map((f) => this.toDto(f));
  }

  async get(id: string) {
    const f = await this.prisma.filamento.findUnique({ where: { id } });
    if (!f) throw new NotFoundException(`Filamento ${id} não existe`);
    return this.toDto(f);
  }

  async create(data: FilamentoCreate) {
    return this.toDto(await this.prisma.filamento.create({ data }));
  }

  async update(id: string, data: FilamentoUpdate) {
    return this.toDto(await this.prisma.filamento.update({ where: { id }, data }));
  }

  // Decimal (gramas) vira number na borda — UI não recebe string.
  private toDto<T extends { estoqueGramas: Prisma.Decimal; estoqueMinGramas: Prisma.Decimal }>(f: T) {
    return {
      ...f,
      estoqueGramas: Number(f.estoqueGramas),
      estoqueMinGramas: Number(f.estoqueMinGramas),
    };
  }

  /** Filamento nunca é deletado (produtos antigos podem referenciá-lo) — só desativado. */
  async desativar(id: string) {
    await this.prisma.filamento.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  }
}
