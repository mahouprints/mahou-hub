import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProdutoCreate, ProdutoUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.produto.findMany({
      orderBy: { criadoEm: 'desc' },
      include: { filamento: true },
    });
  }

  async get(id: string) {
    const p = await this.prisma.produto.findUnique({
      where: { id },
      include: { filamento: true },
    });
    if (!p) throw new NotFoundException(`Produto ${id} não existe`);
    return p;
  }

  create(data: ProdutoCreate) {
    return this.prisma.produto.create({ data });
  }

  update(id: string, data: ProdutoUpdate) {
    return this.prisma.produto.update({ where: { id }, data });
  }

  async desativar(id: string) {
    await this.prisma.produto.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  }
}
