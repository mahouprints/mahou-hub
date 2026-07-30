import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  SKU_MAX,
  type ProdutoVariacaoCreate,
  type ProdutoVariacaoUpdate,
  type VariacoesEmLote,
  type VariacoesEmLoteResultado,
} from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { gerarSku, siglaDaCor } from './gerar-sku';

/** Acrescenta "-2", "-3"… ao SKU sem estourar o teto de caracteres. */
function encurtarPara(base: string, n: number): string {
  const sufixo = `-${n}`;
  return `${base.slice(0, SKU_MAX - sufixo.length)}${sufixo}`;
}

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
      select: { id: true, nome: true },
    });
    if (!produto) throw new NotFoundException(`Produto ${data.produtoId} não existe`);

    const sku =
      data.sku ?? (await this.skuDisponivel(produto.nome, await this.sigla(data.filamentoId, data.nome)));
    try {
      return await this.prisma.produtoVariacao.create({
        data: {
          produtoId: data.produtoId,
          nome: data.nome,
          sku,
          filamentoId: data.filamentoId ?? null,
          precoCentavos: data.precoCentavos ?? null,
          pesoG: data.pesoG ?? null,
          tempoH: data.tempoH ?? null,
          estoqueMinimo: data.estoqueMinimo,
        },
      });
    } catch (err) {
      throw this.traduzirSkuRepetido(err, sku);
    }
  }

  async update(id: string, data: ProdutoVariacaoUpdate) {
    await this.garantirExiste(id);
    try {
      // estoqueAtual fica de fora de propósito: saldo só muda via movimento de estoque.
      return await this.prisma.produtoVariacao.update({ where: { id }, data });
    } catch (err) {
      throw this.traduzirSkuRepetido(err, data.sku ?? '');
    }
  }

  /**
   * Cria a combinação produto × cor de uma vez, pulando o que já existe.
   *
   * Repetir o mesmo lote é seguro: nada duplica, e o que já estava lá não é tocado —
   * é o que permite ir cadastrando aos poucos e rodar de novo quando comprar cor nova.
   */
  async criarEmLote(input: VariacoesEmLote): Promise<VariacoesEmLoteResultado> {
    const [produtos, filamentos] = await Promise.all([
      this.prisma.produto.findMany({
        where: { id: { in: input.produtoIds } },
        select: { id: true, nome: true },
      }),
      this.prisma.filamento.findMany({
        where: { id: { in: input.filamentoIds } },
        select: { id: true, nome: true, siglaCor: true },
      }),
    ]);

    const jaExistem = await this.prisma.produtoVariacao.findMany({
      where: { produtoId: { in: input.produtoIds } },
      select: { produtoId: true, filamentoId: true },
    });
    const existe = new Set(jaExistem.map((v) => `${v.produtoId}|${v.filamentoId}`));

    const novas: VariacoesEmLoteResultado['novas'] = [];
    let puladas = 0;

    for (const produto of produtos) {
      for (const filamento of filamentos) {
        if (existe.has(`${produto.id}|${filamento.id}`)) {
          puladas++;
          continue;
        }
        const sku = await this.skuDisponivel(
          produto.nome,
          filamento.siglaCor ?? siglaDaCor(filamento.nome),
        );
        await this.prisma.produtoVariacao.create({
          data: {
            produtoId: produto.id,
            nome: filamento.nome,
            sku,
            filamentoId: filamento.id,
          },
        });
        novas.push({ produto: produto.nome, cor: filamento.nome, sku });
      }
    }

    return { criadas: novas.length, puladas, novas };
  }

  /**
   * Gera o SKU e resolve colisão. Dois produtos de nome parecido podem render a mesma
   * base ("Cortador Biscoito Copa" e "Cortador Biscoito Copo"): o segundo ganha sufixo
   * numérico em vez de estourar erro na cara de quem só queria cadastrar uma cor.
   */
  private async skuDisponivel(nomeProduto: string, sigla: string | null) {
    const base = gerarSku(nomeProduto, sigla);
    for (let tentativa = 0; tentativa < 50; tentativa++) {
      const candidato = tentativa === 0 ? base : encurtarPara(base, tentativa + 1);
      const existe = await this.prisma.produtoVariacao.findUnique({
        where: { sku: candidato },
        select: { id: true },
      });
      if (!existe) return candidato;
    }
    throw new ConflictException(`Não consegui gerar um SKU livre a partir de "${base}"`);
  }

  /**
   * Sigla da cor: a cadastrada no filamento manda, senão deduz do nome.
   *
   * O nome da variação JÁ é a cor ("Branco", "Preto") e o do filamento traz a cor no meio
   * ("PLA Branco OFF White Velvet Voolt"). Exigir cadastro prévio da sigla fazia o SKU sair
   * sem cor nenhuma, e três cores do mesmo produto viravam "…-2" e "…-3".
   */
  private async sigla(filamentoId?: string | null, nomeDaCor?: string): Promise<string | null> {
    if (filamentoId) {
      const f = await this.prisma.filamento.findUnique({
        where: { id: filamentoId },
        select: { siglaCor: true, nome: true },
      });
      if (f?.siglaCor) return f.siglaCor;
      if (f?.nome) return siglaDaCor(f.nome) || null;
    }
    return nomeDaCor ? siglaDaCor(nomeDaCor) || null : null;
  }

  /** O unique do banco vira 500 sem isso — e "erro inesperado" não ajuda ninguém. */
  private traduzirSkuRepetido(err: unknown, sku: string) {
    const ehUnique =
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      String(err.meta?.target ?? '').includes('sku');
    if (!ehUnique) return err;
    return new ConflictException(
      `O SKU "${sku}" já está em uso por outra variação. Escolha outro código.`,
    );
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
