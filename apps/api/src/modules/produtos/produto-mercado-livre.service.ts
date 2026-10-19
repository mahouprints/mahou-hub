import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MercadoLivreCotacaoInputSchema } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { MercadoLivreService } from '../mercado-livre/mercado-livre.service';

@Injectable()
export class ProdutoMercadoLivreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoLivre: MercadoLivreService,
  ) {}

  /** Cota sem publicar e salva somente se preço e condições ainda são os mesmos. */
  async cotar(id: string) {
    const produto = await this.prisma.produto.findUnique({ where: { id } });
    if (!produto) throw new NotFoundException(`Produto ${id} não existe`);
    const entrada = MercadoLivreCotacaoInputSchema.safeParse({
      ...(typeof produto.mercadoLivre === 'object' ? produto.mercadoLivre : {}),
      precoCentavos: produto.precoCentavos,
    });
    if (!entrada.success)
      throw new BadRequestException(
        'Defina a categoria, as condições do anúncio e as medidas reais do pacote antes de cotar.',
      );
    const cotacao = await this.mercadoLivre.cotar(entrada.data);
    const gravado = await this.prisma.produto.updateMany({
      where: {
        id,
        precoCentavos: produto.precoCentavos,
        mercadoLivre: { equals: produto.mercadoLivre ?? Prisma.JsonNull },
      },
      data: { cotacaoMl: cotacao },
    });
    if (!gravado.count)
      throw new BadRequestException(
        'O preço ou as condições mudaram durante a consulta. Consulte novamente.',
      );
    return cotacao;
  }
}
