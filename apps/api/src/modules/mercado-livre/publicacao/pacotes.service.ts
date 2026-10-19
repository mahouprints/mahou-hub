import { HttpException } from '@nestjs/common';
import { MercadoLivreConfiguracaoSchema, type MercadoLivrePacote } from '@mahou-hub/contracts';
import type { MercadoLivreHttpService } from '../mercado-livre-http.service';
import {
  PacotesEntradaSchema,
  type PacoteItem,
  type ProdutoPacote,
  type RepositorioPacotes,
} from './pacotes-schema';
import { PublicacaoErro } from './publicacao-erro';
import { objeto } from './publicacao-verificacao';

const medidas = {
  alturaCm: ['SELLER_PACKAGE_HEIGHT', 'cm'],
  larguraCm: ['SELLER_PACKAGE_WIDTH', 'cm'],
  comprimentoCm: ['SELLER_PACKAGE_LENGTH', 'cm'],
  pesoGramas: ['SELLER_PACKAGE_WEIGHT', 'g'],
} as const;
type HttpPacotes = Pick<MercadoLivreHttpService, 'sellerId' | 'get' | 'put'>;

function selecionar(valor: unknown, campos: string[]) {
  const atual = objeto(valor);
  return Object.fromEntries(
    campos.filter((campo) => campo in atual).map((campo) => [campo, atual[campo]]),
  );
}

function diagnostico(erro: unknown) {
  const resposta = erro instanceof HttpException ? objeto(erro.getResponse()) : {};
  return {
    indisponivel: true,
    status: typeof resposta.mercadoLivreStatus === 'number' ? resposta.mercadoLivreStatus : null,
    ...(erro instanceof PublicacaoErro ? { motivo: erro.message } : {}),
  };
}

function pacoteConfere(remoto: unknown, pacote: MercadoLivrePacote) {
  const atributos = objeto(remoto).attributes;
  if (!Array.isArray(atributos)) return false;
  return Object.entries(medidas).every(([campo, [id, unidade]]) =>
    atributos.some(
      (valor) =>
        objeto(valor).id === id &&
        objeto(valor).value_name === `${pacote[campo as keyof MercadoLivrePacote]} ${unidade}`,
    ),
  );
}

/** Inspeciona ou corrige somente a embalagem de ofertas já vinculadas ao ERP. */
export class PacotesService {
  constructor(
    private readonly http: HttpPacotes,
    private readonly repositorio: RepositorioPacotes,
  ) {}

  /** Valida o lote inteiro antes de gravar; ex.: corrigir 23 g sem reabrir a publicação. */
  async executar(bruto: unknown) {
    const entrada = PacotesEntradaSchema.parse(bruto);
    const produtos = await this.repositorio.carregar([
      ...new Set(entrada.itens.map((item) => item.produtoId)),
    ]);
    const antes = await Promise.all(entrada.itens.map((item) => this.inspecionar(item)));
    if (entrada.modo === 'inspecionar_pacotes')
      return { modo: entrada.modo, consultadoEm: new Date().toISOString(), itens: antes };
    entrada.itens.forEach((item, indice) => {
      this.conferir(item, produtos, antes[indice]!.anuncio);
      this.conferirPropagacao(item, antes[indice]);
    });
    const resultados: Array<Record<string, unknown>> = [];
    for (const [indice, item] of entrada.itens.entries()) {
      const resultado = await this.corrigir(item, antes[indice]!);
      resultados.push(resultado);
      // Resposta incerta exige inspeção: nunca repetir PUT nem continuar o lote às cegas.
      if (!resultado.confirmado) break;
    }
    return {
      modo: entrada.modo,
      consultadoEm: new Date().toISOString(),
      concluido:
        resultados.length === entrada.itens.length && resultados.every((item) => item.confirmado),
      itens: resultados,
    };
  }

  private conferir(item: PacoteItem, produtos: ProdutoPacote[], remoto: unknown) {
    const produto = produtos.find((atual) => atual.id === item.produtoId);
    const configuracao = MercadoLivreConfiguracaoSchema.safeParse(produto?.mercadoLivre);
    const cor = produto?.variacoes.find((atual) => atual.sku === item.sku && atual.ativo);
    if (!produto?.ativo || produto.rascunho || !cor || !configuracao.success)
      throw new PublicacaoErro(`ERP sem produto, cor ou configuração válida: ${item.sku}.`);
    const config = configuracao.data;
    const vinculos =
      config.publicacao?.itens.filter(
        (atual) => atual.itemId === item.itemId || atual.skus.includes(item.sku),
      ) ?? [];
    const vinculo = vinculos[0];
    if (
      vinculos.length !== 1 ||
      vinculo?.itemId !== item.itemId ||
      vinculo.userProductId !== item.userProductId ||
      vinculo.skus.length !== 1 ||
      vinculo.skus[0] !== item.sku ||
      Object.keys(vinculo.variationIds ?? {}).length
    )
      throw new PublicacaoErro(`Vínculo ERP divergente: ${item.sku}.`);
    if (
      config.categoriaId !== item.categoriaId ||
      (cor.precoCentavos ?? produto.precoCentavos) !== item.precoCentavos ||
      item.pacote.pesoGramas < (cor.pesoG ?? produto.pesoG) ||
      Object.keys(medidas).some(
        (campo) =>
          config[campo as keyof MercadoLivrePacote] !==
          item.pacote[campo as keyof MercadoLivrePacote],
      )
    )
      throw new PublicacaoErro(`Preço, peso ou pacote autorizado diverge do ERP: ${item.sku}.`);
    const anuncio = objeto(remoto);
    const shipping = objeto(anuncio.shipping);
    const atributos = Array.isArray(anuncio.attributes) ? anuncio.attributes.map(objeto) : [];
    if (
      anuncio.id !== item.itemId ||
      String(anuncio.seller_id) !== this.http.sellerId ||
      anuncio.user_product_id !== item.userProductId ||
      anuncio.category_id !== item.categoriaId ||
      anuncio.status !== 'active' ||
      anuncio.currency_id !== 'BRL' ||
      typeof anuncio.price !== 'number' ||
      Math.round(anuncio.price * 100) !== item.precoCentavos ||
      !atributos.some(
        (atributo) => atributo.id === 'SELLER_SKU' && atributo.value_name === item.sku,
      ) ||
      (Array.isArray(anuncio.variations) && anuncio.variations.length) ||
      anuncio.listing_type_id !== config.tipoAnuncio ||
      anuncio.condition !== config.condicao ||
      shipping.mode !== config.modoEnvio ||
      shipping.logistic_type !== config.tipoLogistica ||
      shipping.free_shipping !== config.freteGratis
    )
      throw new PublicacaoErro(`Identidade ou condições do anúncio divergentes: ${item.sku}.`);
  }

  private async corrigir(
    item: PacoteItem,
    antes: Awaited<ReturnType<PacotesService['inspecionar']>>,
  ) {
    let alterado = false;
    let gravacaoTentada = false;
    try {
      // Refaz a guarda imediatamente antes do PUT: cotação e edição podem ocorrer em paralelo.
      const produtos = await this.repositorio.carregar([item.produtoId]);
      const atual = await this.http.get(`/items/${item.itemId}?include_attributes=all`);
      this.conferir(item, produtos, atual);
      if (!pacoteConfere(atual, item.pacote)) {
        const [userProduct, associados] = await Promise.all([
          this.http.get(`/user-products/${item.userProductId}`),
          this.http.get(
            `/users/${this.http.sellerId}/items/search?user_product_id=${item.userProductId}&limit=100`,
          ),
        ]);
        this.conferirPropagacao(item, {
          userProduct,
          associados: this.associadosSeguros(associados),
        });
        gravacaoTentada = true;
        await this.http.put(`/items/${item.itemId}`, {
          attributes: Object.entries(medidas).map(([campo, [id, unidade]]) => ({
            id,
            value_name: `${item.pacote[campo as keyof MercadoLivrePacote]} ${unidade}`,
          })),
        });
        alterado = true;
      }
      const confirmado = await this.http.get(`/items/${item.itemId}?include_attributes=all`);
      this.conferir(item, produtos, confirmado);
      const depois = await this.inspecionar(item, confirmado);
      return {
        sku: item.sku,
        itemId: item.itemId,
        gravacaoTentada,
        alterado,
        confirmado: pacoteConfere(confirmado, item.pacote),
        antes,
        depois,
      };
    } catch (erro) {
      return {
        sku: item.sku,
        itemId: item.itemId,
        gravacaoTentada,
        alterado,
        confirmado: false,
        antes,
        ...(gravacaoTentada ? { depois: await this.inspecionar(item) } : {}),
        erro: diagnostico(erro),
      };
    }
  }

  private conferirPropagacao(item: PacoteItem, inspecao: unknown) {
    const atual = objeto(inspecao);
    const userProduct = objeto(atual.userProduct);
    const associados = objeto(atual.associados);
    if (
      userProduct.id !== item.userProductId ||
      String(userProduct.user_id) !== this.http.sellerId ||
      associados.completo !== true ||
      !Array.isArray(associados.results) ||
      associados.results.length !== 1 ||
      associados.results[0] !== item.itemId
    )
      throw new PublicacaoErro(
        `User Product sem propriedade ou propagação restrita confirmada: ${item.sku}.`,
      );
  }

  private async inspecionar(item: PacoteItem, recebido?: unknown) {
    const bruto = recebido ?? (await this.opcional(`/items/${item.itemId}?include_attributes=all`));
    const anuncio = objeto(bruto);
    if (
      anuncio.id !== item.itemId ||
      String(anuncio.seller_id) !== this.http.sellerId ||
      anuncio.user_product_id !== item.userProductId
    )
      return {
        sku: item.sku,
        itemId: item.itemId,
        anuncio: {
          indisponivel: true,
          motivo: 'Identidade não confirmada.',
          ...('status' in anuncio && anuncio.indisponivel ? { status: anuncio.status } : {}),
        },
      };
    const [categoria, userProduct, associados, logistica, frete] = await Promise.all([
      this.opcional(`/categories/${item.categoriaId}/shipping_preferences`),
      this.opcional(`/user-products/${item.userProductId}`),
      this.opcional(
        `/users/${this.http.sellerId}/items/search?user_product_id=${item.userProductId}&limit=100`,
      ),
      this.opcional(
        `/customers/marketplace/sites/MLB/user-products/${item.userProductId}/contracts/shippability/services?legacy_attributes=true`,
      ),
      this.opcional(
        `/users/${this.http.sellerId}/shipping_options/free?item_id=${item.itemId}&verbose=true&free_shipping=true`,
      ),
    ]);
    return {
      sku: item.sku,
      itemId: item.itemId,
      pacoteAutorizado: item.pacote,
      anuncio: this.anuncioSeguro(anuncio),
      categoria: selecionar(categoria, [
        'dimensions',
        'source',
        'category_id',
        'restricted',
        'me2_restrictions',
        'logistics',
        'indisponivel',
        'status',
      ]),
      userProduct: selecionar(userProduct, [
        'id',
        'user_id',
        'family_id',
        'name',
        'attributes',
        'dimensions',
        'source',
        'status',
        'date_created',
        'last_updated',
        'items',
        'indisponivel',
      ]),
      associados: this.associadosSeguros(associados),
      logistica: this.logisticaSegura(logistica),
      frete: selecionar(frete, ['coverage', 'indisponivel', 'status']),
    };
  }

  private anuncioSeguro(anuncio: Record<string, unknown>) {
    return {
      ...selecionar(anuncio, [
        'id',
        'seller_id',
        'user_product_id',
        'category_id',
        'title',
        'price',
        'currency_id',
        'available_quantity',
        'listing_type_id',
        'condition',
        'status',
        'sub_status',
        'attributes',
        'variations',
        'last_updated',
        'date_created',
        'tags',
      ]),
      shipping: selecionar(anuncio.shipping, [
        'mode',
        'logistic_type',
        'free_shipping',
        'dimensions',
        'tags',
      ]),
    };
  }

  private associadosSeguros(bruto: unknown) {
    const resposta = objeto(bruto);
    const ids = Array.isArray(resposta.results)
      ? resposta.results.filter((id) => typeof id === 'string' && /^MLB\d+$/.test(id))
      : [];
    const total = objeto(resposta.paging).total;
    return {
      ...selecionar(resposta, ['indisponivel', 'status']),
      results: ids,
      total,
      completo: typeof total === 'number' && total === ids.length,
    };
  }

  private logisticaSegura(bruto: unknown) {
    const resposta = objeto(bruto);
    return {
      ...selecionar(resposta, ['indisponivel', 'status']),
      services: (Array.isArray(resposta.services) ? resposta.services : []).map((service) =>
        selecionar(service, [
          'type',
          'direction',
          'flavor',
          'speed',
          'distribution_attributes',
          'legacy_attributes',
        ]),
      ),
    };
  }

  private async opcional(path: string): Promise<unknown> {
    try {
      return await this.http.get(path);
    } catch (erro) {
      return diagnostico(erro);
    }
  }
}
