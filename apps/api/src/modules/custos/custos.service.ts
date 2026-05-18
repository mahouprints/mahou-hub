import { Injectable, NotFoundException } from '@nestjs/common';
import type { CustoCreate, CustoUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

/** Default de meses futuros gerados quando recorrente=true sem `mesesRecorrencia` no payload. */
const MESES_RECORRENCIA_DEFAULT = 12;

@Injectable()
export class CustosService {
  constructor(private readonly prisma: PrismaService) {}

  list(mes?: string) {
    const where = mes ? { dataCompetencia: rangeDoMes(mes) } : {};
    return this.prisma.custo.findMany({
      where,
      orderBy: [{ dataCompetencia: 'desc' }, { categoria: 'asc' }],
    });
  }

  async get(id: string) {
    const c = await this.prisma.custo.findUnique({ where: { id } });
    if (!c) throw new NotFoundException(`Custo ${id} não existe`);
    return c;
  }

  /**
   * Cria o custo. Se recorrente=true, gera `mesesRecorrencia` cópias mensais
   * subsequentes (default 12). Cópias herdam geradoAutomatico=true,
   * recorrente=false pra não cascatear; cada uma é editável/deletável
   * individualmente.
   */
  async create(data: CustoCreate) {
    const { mesesRecorrencia, ...persistivel } = data;
    const base = await this.prisma.custo.create({
      data: { ...persistivel, geradoAutomatico: false },
    });
    if (data.recorrente) {
      const n = mesesRecorrencia ?? MESES_RECORRENCIA_DEFAULT;
      const futuros = mesesSeguintes(data.dataCompetencia, n).map((d) => ({
        descricao: data.descricao,
        categoria: data.categoria,
        valorCentavos: data.valorCentavos,
        dataCompetencia: d,
        recorrente: false,
        geradoAutomatico: true,
        observacao: data.observacao,
      }));
      await this.prisma.custo.createMany({ data: futuros });
    }
    return base;
  }

  update(id: string, data: CustoUpdate) {
    // mesesRecorrencia só faz sentido na criação — descarta no update.
    const { mesesRecorrencia: _ignorado, ...persistivel } = data;
    return this.prisma.custo.update({ where: { id }, data: persistivel });
  }

  async remove(id: string) {
    await this.prisma.custo.delete({ where: { id } });
    return { ok: true };
  }
}

function rangeDoMes(mes: string) {
  const [ano, mm] = mes.split('-').map(Number);
  if (!ano || !mm || mm < 1 || mm > 12) {
    throw new Error(`mes inválido: ${mes} (esperado YYYY-MM)`);
  }
  return {
    gte: new Date(Date.UTC(ano, mm - 1, 1)),
    lt: new Date(Date.UTC(ano, mm, 1)),
  };
}

/** Gera array de Date com dia 1 dos N meses subsequentes a `inicio`. */
function mesesSeguintes(inicio: Date, n: number): Date[] {
  const baseAno = inicio.getUTCFullYear();
  const baseMes = inicio.getUTCMonth();
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(baseAno, baseMes + i + 1, 1)));
}
