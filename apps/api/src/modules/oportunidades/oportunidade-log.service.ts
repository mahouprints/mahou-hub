import { Injectable } from '@nestjs/common';
import { Prisma, type OportunidadeLogAcao } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Audit trail das mudanças em ProdutoOportunidade. Append-only.
 * Cada mudança vira 1 log com detalhes do que mudou (de → para).
 * Use os helpers ao invés de chamar `create` direto pra manter shapes consistentes.
 */
@Injectable()
export class OportunidadeLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(oportunidadeId: string) {
    return this.prisma.oportunidadeLog.findMany({
      where: { oportunidadeId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  // Cria log de "oportunidade nova" — chamado em create() e bulk.
  async logCreated(
    oportunidadeId: string,
    snapshot: { fonte: string; status: string; score: number | null; marketplace: string },
    usuarioId: string | null,
  ) {
    return this.create(oportunidadeId, 'CREATED', snapshot, usuarioId);
  }

  // Cria log de mudança de status. Idempotente: se de === para, não loga.
  async logStatusChange(
    oportunidadeId: string,
    de: string,
    para: string,
    usuarioId: string | null,
  ) {
    if (de === para) return null;
    return this.create(oportunidadeId, 'STATUS_CHANGE', { de, para }, usuarioId);
  }

  // Cria log de score change. Aceita null nos dois lados.
  async logScoreChange(
    oportunidadeId: string,
    de: number | null,
    para: number | null,
    usuarioId: string | null,
  ) {
    if (de === para) return null;
    return this.create(oportunidadeId, 'SCORE_CHANGE', { de, para }, usuarioId);
  }

  // Notas: registra só o fato (não diff completo, pra não inflar). Tamanho original e novo.
  async logNotasChange(
    oportunidadeId: string,
    de: string | null,
    para: string | null,
    usuarioId: string | null,
  ) {
    if ((de ?? '') === (para ?? '')) return null;
    return this.create(
      oportunidadeId,
      'NOTAS_CHANGE',
      { tamanhoDe: de?.length ?? 0, tamanhoPara: para?.length ?? 0 },
      usuarioId,
    );
  }

  async logVirouProduto(oportunidadeId: string, produtoId: string, usuarioId: string | null) {
    return this.create(oportunidadeId, 'VIRARAM_PRODUTO', { produtoId }, usuarioId);
  }

  private async create(
    oportunidadeId: string,
    acao: OportunidadeLogAcao,
    detalhes: object,
    usuarioId: string | null,
  ) {
    return this.prisma.oportunidadeLog.create({
      data: {
        oportunidadeId,
        acao,
        detalhes: detalhes as Prisma.InputJsonValue,
        usuarioId,
      },
    });
  }
}
