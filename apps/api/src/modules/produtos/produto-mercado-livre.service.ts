import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Produto, type ProdutoVariacao } from '@prisma/client';
import {
  MercadoLivreConfiguracaoSchema,
  MercadoLivreCotacaoInputSchema,
  type MercadoLivreCotacao,
  type MercadoLivreCotacaoInput,
  type MercadoLivrePublicacao,
} from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { MercadoLivreService } from '../mercado-livre/mercado-livre.service';

type VariacaoParaCotacao = Pick<
  ProdutoVariacao,
  'id' | 'sku' | 'precoCentavos' | 'pesoG' | 'atualizadoEm'
>;
type ProdutoParaCotacao = Produto & { variacoes: VariacaoParaCotacao[] };

@Injectable()
export class ProdutoMercadoLivreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoLivre: MercadoLivreService,
  ) {}

  /** Cota sem publicar e salva somente se preço e condições ainda são os mesmos. */
  async cotar(id: string) {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
      include: {
        variacoes: {
          where: { ativo: true },
          select: {
            id: true,
            sku: true,
            precoCentavos: true,
            pesoG: true,
            atualizadoEm: true,
          },
        },
      },
    });
    if (!produto) throw new NotFoundException(`Produto ${id} não existe`);
    const entrada = MercadoLivreCotacaoInputSchema.safeParse({
      ...(typeof produto.mercadoLivre === 'object' ? produto.mercadoLivre : {}),
      precoCentavos: produto.precoCentavos,
    });
    if (!entrada.success)
      throw new BadRequestException(
        'Defina a categoria, as condições do anúncio e as medidas reais do pacote antes de cotar.',
      );
    const configuracao = MercadoLivreConfiguracaoSchema.parse(produto.mercadoLivre);
    const publicados = configuracao.publicacao?.itens ?? [];
    if (entrada.data.itemId && !publicados.length) await this.conferirAnuncio(entrada.data);
    const cotacao: MercadoLivreCotacao = await this.mercadoLivre.cotar(entrada.data);
    if (publicados.length) await this.cotarCores(produto, entrada.data, publicados, cotacao);
    const gravado = await this.prisma.produto.updateMany({
      where: {
        id,
        precoCentavos: produto.precoCentavos,
        mercadoLivre: { equals: produto.mercadoLivre ?? Prisma.JsonNull },
        ...(publicados.length ? this.guardaVariacoes(produto) : {}),
      },
      data: { cotacaoMl: cotacao },
    });
    if (!gravado.count)
      throw new BadRequestException(
        'O preço ou as condições mudaram durante a consulta. Consulte novamente.',
      );
    return cotacao;
  }

  private async cotarCores(
    produto: ProdutoParaCotacao,
    entrada: MercadoLivreCotacaoInput,
    publicados: MercadoLivrePublicacao['itens'],
    cotacao: MercadoLivreCotacao,
  ): Promise<void> {
    cotacao.porSku = {};
    for (const variacao of produto.variacoes) {
      try {
        const contexto = this.contextoDaCor(produto, variacao, entrada, publicados);
        await this.conferirAnuncio(contexto, variacao.sku);
        cotacao.porSku[variacao.sku] = await this.mercadoLivre.cotar(contexto);
      } catch {
        cotacao.pendencias.push(
          `${variacao.sku}: vínculo, anúncio ou cotação não confirmado; consulte novamente.`,
        );
      }
    }
  }

  private contextoDaCor(
    produto: ProdutoParaCotacao,
    variacao: VariacaoParaCotacao,
    entrada: MercadoLivreCotacaoInput,
    publicados: MercadoLivrePublicacao['itens'],
  ): MercadoLivreCotacaoInput {
    const vinculos = publicados.filter((item) => item.skus.includes(variacao.sku));
    const vinculo = vinculos[0];
    if (
      vinculos.length !== 1 ||
      !vinculo ||
      vinculo.skus.length !== 1 ||
      Object.keys(vinculo.variationIds ?? {}).length ||
      entrada.pesoGramas < Number(produto.pesoG) ||
      (variacao.pesoG !== null && Number(variacao.pesoG) !== Number(produto.pesoG))
    )
      throw new BadRequestException('Vínculo individual ou pacote não confirmado.');
    return {
      ...entrada,
      itemId: vinculo.itemId,
      precoCentavos: variacao.precoCentavos ?? produto.precoCentavos,
    };
  }

  private guardaVariacoes(produto: ProdutoParaCotacao): Prisma.ProdutoWhereInput {
    return {
      pesoG: produto.pesoG,
      variacoes: { every: { OR: [{ ativo: false }, ...produto.variacoes] } },
      AND: produto.variacoes.map((variacao) => ({
        variacoes: { some: { id: variacao.id, ativo: true } },
      })),
    };
  }

  private async conferirAnuncio(contexto: MercadoLivreCotacaoInput, sku?: string): Promise<void> {
    const anuncio = await this.mercadoLivre.anuncio(contexto.itemId!);
    const campos = [
      'itemId',
      'precoCentavos',
      'categoriaId',
      'tipoAnuncio',
      'modoEnvio',
      'tipoLogistica',
      'freteGratis',
      'condicao',
    ] as const;
    if (
      campos.some((campo) => anuncio[campo] !== contexto[campo]) ||
      anuncio.status !== 'active' ||
      anuncio.moeda !== 'BRL' ||
      anuncio.temVariacoes ||
      (sku !== undefined && anuncio.sku !== sku)
    )
      throw new BadRequestException(
        'O anúncio deve corresponder ao SKU, preço, categoria e envio cadastrados.',
      );
    const dimensoes = ['alturaCm', 'larguraCm', 'comprimentoCm'] as const;
    const recebido = dimensoes.map((campo) => anuncio[campo]).sort((a, b) => Number(a) - Number(b));
    const esperado = dimensoes.map((campo) => contexto[campo]).sort((a, b) => a - b);
    if (
      anuncio.pesoGramas !== contexto.pesoGramas ||
      recebido.some((valor, indice) => valor !== esperado[indice])
    )
      throw new BadRequestException('As medidas do anúncio divergem do pacote cadastrado.');
  }
}
