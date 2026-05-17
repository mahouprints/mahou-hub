import { Injectable, NotFoundException } from '@nestjs/common';
import type { VendaCreate, VendaUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista vendas, opcionalmente filtradas por mês competência (YYYY-MM).
   * Sempre incluindo produto+filamento pra UI exibir nome legível.
   */
  list(mes?: string) {
    const where = mes ? { dataVenda: rangeDoMes(mes) } : {};
    return this.prisma.venda.findMany({
      where,
      orderBy: { dataVenda: 'desc' },
      include: { produto: { include: { filamento: true } } },
    });
  }

  async get(id: string) {
    const v = await this.prisma.venda.findUnique({
      where: { id },
      include: { produto: { include: { filamento: true } } },
    });
    if (!v) throw new NotFoundException(`Venda ${id} não existe`);
    return v;
  }

  create(data: VendaCreate) {
    return this.prisma.venda.create({ data });
  }

  update(id: string, data: VendaUpdate) {
    return this.prisma.venda.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.venda.delete({ where: { id } });
    return { ok: true };
  }
}

/** Devolve { gte, lt } cobrindo o mês inteiro a partir de string YYYY-MM. */
function rangeDoMes(mes: string) {
  const [ano, mm] = mes.split('-').map(Number);
  if (!ano || !mm || mm < 1 || mm > 12) {
    throw new Error(`mes inválido: ${mes} (esperado YYYY-MM)`);
  }
  const gte = new Date(Date.UTC(ano, mm - 1, 1));
  const lt = new Date(Date.UTC(ano, mm, 1));
  return { gte, lt };
}
