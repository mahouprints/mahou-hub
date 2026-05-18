import { Injectable, NotFoundException } from '@nestjs/common';
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
    return this.prisma.insumo.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: { _count: { select: { produtos: true } } },
    });
  }

  async get(id: string) {
    const i = await this.prisma.insumo.findUnique({ where: { id } });
    if (!i) throw new NotFoundException(`Insumo ${id} não existe`);
    return i;
  }

  create(data: InsumoCreate) {
    return this.prisma.insumo.create({ data });
  }

  update(id: string, data: InsumoUpdate) {
    return this.prisma.insumo.update({ where: { id }, data });
  }

  /** Soft-delete: produtos antigos podem referenciar e queremos preservar histórico. */
  async desativar(id: string) {
    await this.prisma.insumo.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  }
}
