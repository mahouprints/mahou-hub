import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProdutoVariacaoCreate, ProdutoVariacaoUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VariacoesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista variações de um produto. Inclui o filamento (cor) quando há override. */
  listByProduto(produtoId: string, incluirInativos = false) {
    return this.prisma.produtoVariacao.findMany({
      where: { produtoId, ...(incluirInativos ? {} : { ativo: true }) },
      include: { filamento: true },
      orderBy: { nome: 'asc' },
    });
  }

  /**
   * Todas as variações ativas com produto e cor (filamento). Alimenta a aba "Produtos
   * prontos" do estoque e o diálogo de job (que indexa por produtoId pra mostrar a qtd por cor).
   */
  listParaEstoque() {
    return this.prisma.produtoVariacao.findMany({
      where: { ativo: true },
      include: {
        filamento: { select: { nome: true } },
        produto: { select: { nome: true } },
      },
      orderBy: [{ produto: { nome: 'asc' } }, { nome: 'asc' }],
    });
  }

  async create(data: ProdutoVariacaoCreate) {
    const produto = await this.prisma.produto.findUnique({
      where: { id: data.produtoId },
      select: { id: true },
    });
    if (!produto) throw new NotFoundException(`Produto ${data.produtoId} não existe`);
    return this.prisma.produtoVariacao.create({
      data: {
        produtoId: data.produtoId,
        nome: data.nome,
        sku: data.sku,
        filamentoId: data.filamentoId ?? null,
        precoCentavos: data.precoCentavos ?? null,
        estoqueMinimo: data.estoqueMinimo,
      },
    });
  }

  async update(id: string, data: ProdutoVariacaoUpdate) {
    await this.garantirExiste(id);
    // estoqueAtual fica de fora de propósito: saldo só muda via movimento de estoque.
    return this.prisma.produtoVariacao.update({ where: { id }, data });
  }

  /** Soft-delete: variação pode estar referenciada em pedidos/histórico. */
  async desativar(id: string) {
    await this.garantirExiste(id);
    await this.prisma.produtoVariacao.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  }

  private async garantirExiste(id: string) {
    const v = await this.prisma.produtoVariacao.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!v) throw new NotFoundException(`Variação ${id} não existe`);
  }
}
