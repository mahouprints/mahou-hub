import { Injectable, NotFoundException } from '@nestjs/common';
import type { FilamentoCreate, FilamentoUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class FilamentosService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.filamento.findMany({ orderBy: { nome: 'asc' } });
  }

  async get(id: string) {
    const f = await this.prisma.filamento.findUnique({ where: { id } });
    if (!f) throw new NotFoundException(`Filamento ${id} não existe`);
    return f;
  }

  create(data: FilamentoCreate) {
    return this.prisma.filamento.create({ data });
  }

  update(id: string, data: FilamentoUpdate) {
    return this.prisma.filamento.update({ where: { id }, data });
  }

  /** Filamento nunca é deletado (produtos antigos podem referenciá-lo) — só desativado. */
  async desativar(id: string) {
    await this.prisma.filamento.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  }
}
