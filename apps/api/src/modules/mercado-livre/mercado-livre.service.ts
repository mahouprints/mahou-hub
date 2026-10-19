import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import type { MercadoLivreCotacaoInput, MercadoLivreCotacao } from '@mahou-hub/contracts';
import { MercadoLivreHttpService } from './mercado-livre-http.service';

interface CategoriaMl {
  id: string;
  name: string;
  path_from_root: { id: string; name: string }[];
  children_categories: { id: string }[];
  settings?: { listing_allowed?: boolean };
}
interface SugestaoMl {
  category_id: string;
  category_name: string;
  domain_id: string;
  domain_name: string;
}
interface TarifaMl {
  listing_type_id: string;
  currency_id?: string;
  sale_fee_amount: number;
  sale_fee_details?: { fixed_fee?: number; percentage_fee?: number };
}
interface AnuncioMl {
  id: string;
  seller_id: number;
  category_id: string;
  title: string;
  price: number;
  listing_type_id: string;
  condition: string;
  status?: string;
  currency_id?: string;
  attributes?: { id?: string; value_name?: string }[];
  variations?: unknown[];
  shipping?: {
    mode?: string;
    logistic_type?: string;
    free_shipping?: boolean;
    dimensions?: string | null;
  };
}

function centavos(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
    ? Math.round(valor * 100)
    : null;
}

@Injectable()
export class MercadoLivreService {
  constructor(private readonly http: MercadoLivreHttpService) {}

  /** Sugere categorias oficiais pelo título. Ex.: sugerirCategorias('Ratinho articulado'). */
  async sugerirCategorias(titulo: string) {
    const query = new URLSearchParams({ q: titulo, limit: '5' });
    const sugestoes = await this.http.get<SugestaoMl[]>(
      `/sites/MLB/domain_discovery/search?${query}`,
    );
    return sugestoes.map((sugestao) => ({
      id: sugestao.category_id,
      nome: sugestao.category_name,
      dominioId: sugestao.domain_id,
      dominioNome: sugestao.domain_name,
    }));
  }

  /** Valida a categoria folha antes de cotar. Ex.: categoria('MLB123'). */
  async categoria(id: string) {
    const categoria = await this.http.get<CategoriaMl>(`/categories/${encodeURIComponent(id)}`);
    return {
      id: categoria.id,
      nome: categoria.name,
      caminho: (categoria.path_from_root ?? []).map((nivel) => ({
        id: nivel.id,
        nome: nivel.name,
      })),
      permiteAnunciar:
        categoria.settings?.listing_allowed === true && categoria.children_categories?.length === 0,
    };
  }

  /** Importa contexto somente de anúncio da própria loja. Ex.: anuncio('MLB123456'). */
  async anuncio(itemId: string) {
    const anuncio = await this.http.get<AnuncioMl>(
      `/items/${encodeURIComponent(itemId)}?include_attributes=all`,
    );
    if (String(anuncio.seller_id) !== this.http.sellerId) {
      throw new BadRequestException('O anúncio recebido deve pertencer à conta ML configurada.');
    }
    return {
      itemId: anuncio.id,
      titulo: anuncio.title,
      categoriaId: anuncio.category_id,
      precoCentavos: centavos(anuncio.price),
      tipoAnuncio: anuncio.listing_type_id,
      modoEnvio: anuncio.shipping?.mode ?? null,
      tipoLogistica: anuncio.shipping?.logistic_type ?? null,
      freteGratis: anuncio.shipping?.free_shipping ?? null,
      condicao: anuncio.condition,
      status: anuncio.status,
      moeda: anuncio.currency_id,
      sku: anuncio.attributes?.find((atributo) => atributo.id === 'SELLER_SKU')?.value_name,
      temVariacoes: Boolean(anuncio.variations?.length),
      ...this.dimensoesAnuncio(anuncio.shipping?.dimensions, anuncio.attributes),
    };
  }

  /** Consulta tarifa e frete oficiais para uma configuração. Ex.: cotar(contexto). */
  async cotar(contexto: MercadoLivreCotacaoInput): Promise<MercadoLivreCotacao> {
    const categoria = await this.categoria(contexto.categoriaId);
    if (!categoria.permiteAnunciar)
      throw new BadRequestException('Escolha uma categoria final que permita anunciar.');
    const [tarifa, frete] = await Promise.all([
      this.consultarTarifa(contexto),
      this.consultarFrete(contexto),
    ]);
    return {
      contexto,
      categoriaNome: categoria.nome,
      ...tarifa,
      freteCentavos: frete,
      cotadoEm: new Date().toISOString(),
      pendencias:
        frete === null ? ['Frete do vendedor indisponível no ML; margem completa pendente.'] : [],
    };
  }

  private async consultarTarifa(contexto: MercadoLivreCotacaoInput) {
    const query = new URLSearchParams({
      category_id: contexto.categoriaId,
      price: (contexto.precoCentavos / 100).toFixed(2),
      currency_id: 'BRL',
      listing_type_id: contexto.tipoAnuncio,
      logistic_type: contexto.tipoLogistica,
      shipping_mode: contexto.modoEnvio,
    });
    const resposta = await this.http.get<TarifaMl[] | TarifaMl>(
      `/sites/MLB/listing_prices?${query}`,
    );
    const tarifa = (Array.isArray(resposta) ? resposta : [resposta]).find(
      (item) => item.listing_type_id === contexto.tipoAnuncio,
    );
    const total = centavos(tarifa?.sale_fee_amount);
    const fixa = centavos(tarifa?.sale_fee_details?.fixed_fee);
    const informado = tarifa?.sale_fee_details?.percentage_fee;
    const percentual =
      typeof informado === 'number' && Number.isFinite(informado) && informado >= 0
        ? informado
        : null;
    if (total === null || (tarifa?.currency_id && tarifa.currency_id !== 'BRL')) {
      throw new BadGatewayException(
        'O ML retornou uma tarifa incompleta para a categoria e configuração selecionadas.',
      );
    }
    // sale_fee_amount já inclui fixed_fee; o detalhamento é informativo e pode ser omitido pelo ML.
    return { tarifaCentavos: total, tarifaFixaCentavos: fixa, percentualTarifa: percentual };
  }

  private async consultarFrete(contexto: MercadoLivreCotacaoInput): Promise<number | null> {
    const query = new URLSearchParams({
      ...(contexto.itemId
        ? { item_id: contexto.itemId }
        : {
            dimensions: `${contexto.alturaCm}x${contexto.larguraCm}x${contexto.comprimentoCm},${contexto.pesoGramas}`,
          }),
      verbose: 'true',
      item_price: (contexto.precoCentavos / 100).toFixed(2),
      listing_type_id: contexto.tipoAnuncio,
      mode: contexto.modoEnvio,
      condition: contexto.condicao,
      logistic_type: contexto.tipoLogistica,
      free_shipping: String(contexto.freteGratis),
    });
    try {
      const resposta = await this.http.get<{
        coverage?: { all_country?: { list_cost?: number; currency_id?: string } };
      }>(`/users/${this.http.sellerId}/shipping_options/free?${query}`);
      // list_cost estima o custo do vendedor já descontado; discount.rate não é outra dedução.
      const custo = resposta.coverage?.all_country;
      if (custo?.currency_id && custo.currency_id !== 'BRL') return null;
      return centavos(custo?.list_cost);
    } catch {
      return null;
    }
  }

  private dimensoesAnuncio(dimensoes?: string | null, atributos: AnuncioMl['attributes'] = []) {
    const partes = dimensoes?.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?),(\d+)$/);
    if (!partes) return this.medidasDosAtributos(atributos);
    return {
      alturaCm: Number(partes[1]),
      larguraCm: Number(partes[2]),
      comprimentoCm: Number(partes[3]),
      pesoGramas: Number(partes[4]),
    };
  }

  private medidasDosAtributos(atributos: NonNullable<AnuncioMl['attributes']>) {
    const medida = (id: string, unidade: string): number | undefined => {
      const texto = atributos.find((atributo) => atributo.id === id)?.value_name;
      const partes = texto?.match(/^(\d+(?:\.\d+)?)\s+(cm|g)$/);
      return partes?.[2] === unidade && Number(partes[1]) > 0 ? Number(partes[1]) : undefined;
    };
    return {
      alturaCm: medida('SELLER_PACKAGE_HEIGHT', 'cm'),
      larguraCm: medida('SELLER_PACKAGE_WIDTH', 'cm'),
      comprimentoCm: medida('SELLER_PACKAGE_LENGTH', 'cm'),
      pesoGramas: medida('SELLER_PACKAGE_WEIGHT', 'g'),
    };
  }
}
