import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MovimentoCreate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

type HistoricoFiltros = {
  tipoItem?: 'PRODUTO' | 'FILAMENTO' | 'INSUMO';
  variacaoId?: string;
  filamentoId?: string;
  insumoId?: string;
  limit?: number;
};

@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra um movimento e atualiza o saldo do item na MESMA transação.
   * `quantidade` é com sinal: positivo = entrada, negativo = saída.
   * Saída que deixaria o saldo negativo é bloqueada (derruba a transação).
   */
  async registrarMovimento(input: MovimentoCreate, opts: { permitirNegativo?: boolean } = {}) {
    const permitir = opts.permitirNegativo ?? false;
    return this.prisma.$transaction(async (tx) => {
      switch (input.tipoItem) {
        case 'PRODUTO':
          return this.moverVariacao(tx, input, permitir);
        case 'FILAMENTO':
          return this.moverFilamento(tx, input, permitir);
        case 'INSUMO':
          return this.moverInsumo(tx, input, permitir);
        default:
          throw new BadRequestException('tipoItem inválido');
      }
    });
  }

  private async moverVariacao(
    tx: Prisma.TransactionClient,
    input: MovimentoCreate,
    permitirNegativo: boolean,
  ) {
    if (!input.variacaoId) throw new BadRequestException('variacaoId é obrigatório para PRODUTO');
    const variacao = await tx.produtoVariacao.findUnique({ where: { id: input.variacaoId } });
    if (!variacao) throw new NotFoundException(`Variação ${input.variacaoId} não existe`);
    const novoSaldo = variacao.estoqueAtual + input.quantidade;
    this.bloquearNegativo(novoSaldo < 0 && !permitirNegativo, variacao.estoqueAtual, input.quantidade);
    await tx.produtoVariacao.update({
      where: { id: variacao.id },
      data: { estoqueAtual: novoSaldo },
    });
    return this.criarMovimento(tx, input, { variacaoId: variacao.id }, novoSaldo);
  }

  private async moverFilamento(
    tx: Prisma.TransactionClient,
    input: MovimentoCreate,
    permitirNegativo: boolean,
  ) {
    if (!input.filamentoId) throw new BadRequestException('filamentoId é obrigatório para FILAMENTO');
    const filamento = await tx.filamento.findUnique({ where: { id: input.filamentoId } });
    if (!filamento) throw new NotFoundException(`Filamento ${input.filamentoId} não existe`);
    const novoSaldo = filamento.estoqueGramas.plus(input.quantidade);
    this.bloquearNegativo(
      novoSaldo.lessThan(0) && !permitirNegativo,
      filamento.estoqueGramas,
      input.quantidade,
    );
    await tx.filamento.update({
      where: { id: filamento.id },
      data: { estoqueGramas: novoSaldo },
    });
    return this.criarMovimento(tx, input, { filamentoId: filamento.id }, novoSaldo);
  }

  private async moverInsumo(
    tx: Prisma.TransactionClient,
    input: MovimentoCreate,
    permitirNegativo: boolean,
  ) {
    if (!input.insumoId) throw new BadRequestException('insumoId é obrigatório para INSUMO');
    const insumo = await tx.insumo.findUnique({ where: { id: input.insumoId } });
    if (!insumo) throw new NotFoundException(`Insumo ${input.insumoId} não existe`);
    const novoSaldo = insumo.estoqueAtual.plus(input.quantidade);
    this.bloquearNegativo(
      novoSaldo.lessThan(0) && !permitirNegativo,
      insumo.estoqueAtual,
      input.quantidade,
    );
    await tx.insumo.update({
      where: { id: insumo.id },
      data: { estoqueAtual: novoSaldo },
    });
    return this.criarMovimento(tx, input, { insumoId: insumo.id }, novoSaldo);
  }

  private bloquearNegativo(
    negativo: boolean,
    saldoAtual: number | Prisma.Decimal,
    quantidade: number,
  ) {
    if (negativo) {
      throw new BadRequestException(
        `Saldo insuficiente: disponível ${saldoAtual.toString()}, saída de ${Math.abs(quantidade)}`,
      );
    }
  }

  private async criarMovimento(
    tx: Prisma.TransactionClient,
    input: MovimentoCreate,
    ref: { variacaoId?: string; filamentoId?: string; insumoId?: string },
    saldoApos: number | Prisma.Decimal,
  ) {
    const movimento = await tx.movimentoEstoque.create({
      data: {
        tipoItem: input.tipoItem,
        ...ref,
        quantidade: new Prisma.Decimal(input.quantidade),
        saldoApos: new Prisma.Decimal(saldoApos),
        motivo: input.motivo,
        custoUnitCentavos: input.custoUnitCentavos ?? null,
        observacao: input.observacao ?? null,
      },
    });
    return this.toDto(movimento);
  }

  async historico(filtros: HistoricoFiltros) {
    const movimentos = await this.prisma.movimentoEstoque.findMany({
      where: {
        ...(filtros.tipoItem ? { tipoItem: filtros.tipoItem } : {}),
        ...(filtros.variacaoId ? { variacaoId: filtros.variacaoId } : {}),
        ...(filtros.filamentoId ? { filamentoId: filtros.filamentoId } : {}),
        ...(filtros.insumoId ? { insumoId: filtros.insumoId } : {}),
      },
      include: {
        variacao: { select: { nome: true, produto: { select: { nome: true } } } },
        filamento: { select: { nome: true } },
        insumo: { select: { nome: true, unidade: true } },
      },
      orderBy: { criadoEm: 'desc' },
      take: filtros.limit ?? 100,
    });
    return movimentos.map((m) => this.toDto(m));
  }

  /** Itens ativos cujo saldo está no/abaixo do mínimo configurado (só conta mínimo > 0). */
  async alertas() {
    const [filamentos, insumos, variacoes] = await Promise.all([
      this.prisma.filamento.findMany({ where: { ativo: true, estoqueMinGramas: { gt: 0 } } }),
      this.prisma.insumo.findMany({ where: { ativo: true, estoqueMinimo: { gt: 0 } } }),
      this.prisma.produtoVariacao.findMany({
        where: { ativo: true, estoqueMinimo: { gt: 0 } },
        include: { produto: { select: { nome: true } } },
      }),
    ]);
    return [
      ...filamentos
        .filter((f) => f.estoqueGramas.lessThanOrEqualTo(f.estoqueMinGramas))
        .map((f) => ({
          tipo: 'FILAMENTO' as const,
          id: f.id,
          nome: f.nome,
          unidade: 'g',
          saldo: Number(f.estoqueGramas),
          minimo: Number(f.estoqueMinGramas),
        })),
      ...insumos
        .filter((i) => i.estoqueAtual.lessThanOrEqualTo(i.estoqueMinimo))
        .map((i) => ({
          tipo: 'INSUMO' as const,
          id: i.id,
          nome: i.nome,
          unidade: i.unidade,
          saldo: Number(i.estoqueAtual),
          minimo: Number(i.estoqueMinimo),
        })),
      ...variacoes
        .filter((v) => v.estoqueAtual <= v.estoqueMinimo)
        .map((v) => ({
          tipo: 'PRODUTO' as const,
          id: v.id,
          nome: `${v.produto.nome} — ${v.nome}`,
          unidade: 'un',
          saldo: v.estoqueAtual,
          minimo: v.estoqueMinimo,
        })),
    ];
  }

  // Decimal vira number na borda (mesma convenção dos outros módulos).
  private toDto<T extends { quantidade: Prisma.Decimal; saldoApos: Prisma.Decimal }>(m: T) {
    return { ...m, quantidade: Number(m.quantidade), saldoApos: Number(m.saldoApos) };
  }
}
