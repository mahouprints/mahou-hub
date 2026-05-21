import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  GapCopiarRascunho,
  GapDecidir,
  OportunidadeMarketplace,
} from '@mahou-hub/contracts';
import { Canal } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GapsActionsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Persiste decisão manual (MATCH_MANUAL / DESCARTADO) por (marketplace, externalId).
  /// Upsert: rerodar com decisão diferente sobrescreve.
  async decidir(
    marketplace: OportunidadeMarketplace,
    externalId: string,
    data: GapDecidir,
    usuarioId: string,
  ) {
    if (data.produtoId) {
      const produto = await this.prisma.produto.findUnique({ where: { id: data.produtoId } });
      if (!produto) throw new NotFoundException(`Produto ${data.produtoId} não encontrado.`);
    }
    const where = { marketplace_externalId: { marketplace, externalId } };
    return this.prisma.produtoGapDecisao.upsert({
      where,
      create: {
        marketplace,
        externalId,
        decisao: data.decisao,
        produtoId: data.produtoId ?? null,
        observacao: data.observacao ?? null,
        decididoPor: usuarioId,
      },
      update: {
        decisao: data.decisao,
        produtoId: data.produtoId ?? null,
        observacao: data.observacao ?? null,
        decididoPor: usuarioId,
        decididoEm: new Date(),
      },
    });
  }

  /// Remove decisão (reverte ao estado classificado automaticamente).
  async revogarDecisao(marketplace: OportunidadeMarketplace, externalId: string) {
    return this.prisma.produtoGapDecisao
      .delete({ where: { marketplace_externalId: { marketplace, externalId } } })
      .catch(() => null);
  }

  /// Cria Produto rascunho a partir do produto Shopee do snapshot.
  /// Peso/tempo zerados — usuário completa antes de anunciar.
  async copiarRascunho(
    marketplace: OportunidadeMarketplace,
    externalId: string,
    data: GapCopiarRascunho,
  ) {
    if (marketplace !== 'SHOPEE') {
      throw new BadRequestException(`Cópia ainda só suporta SHOPEE — recebido ${marketplace}`);
    }
    const snapshot = await this.prisma.concorrenteSnapshotProduto.findFirst({
      where: { itemId: BigInt(externalId) },
      orderBy: { snapshot: { sincronizadoEm: 'desc' } },
      include: { snapshot: { include: { concorrente: true } } },
    });
    if (!snapshot) {
      throw new NotFoundException(
        `Produto ${externalId} não encontrado em snapshots de concorrentes.`,
      );
    }
    const filamento = await this.prisma.filamento.findUnique({ where: { id: data.filamentoId } });
    if (!filamento) throw new NotFoundException(`Filamento ${data.filamentoId} não encontrado.`);

    return this.prisma.produto.create({
      data: {
        nome: snapshot.productName,
        inspiracao: snapshot.productLink,
        // Sem modelo3dUrl — usuário busca depois.
        filamentoId: data.filamentoId,
        // Zerados — usuário completa.
        pesoG: 0,
        tempoH: 0,
        impressora: 'A1',
        embalagemCentavos: 0,
        precoCentavos: snapshot.priceMinCentavos,
        canalPrincipal: (data.canalPrincipal as Canal | undefined) ?? Canal.SHOPEE,
        rascunho: true,
        ativo: true,
        anunciado: false,
      },
    });
  }
}
