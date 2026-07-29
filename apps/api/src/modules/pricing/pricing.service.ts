import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  arredondarCentavos,
  calcularPlanoAds,
  calcularProduto,
  simularCenario,
  taxaMercadoLivreCentavos,
  taxaShopeeCentavos,
  taxaTikTokCentavos,
  type CalculoSaida,
  type FaixaMercadoLivre as FaixaMlPricing,
  type FaixaShopee as FaixaShopeePricing,
  type Filamento as FilamentoPricing,
  type ParametrosGlobais,
  type ParamsAds,
} from '@mahou-hub/pricing';
import type {
  AnuncioMarketplace,
  CalcularInput,
  EconomiaModelo,
  PlanoAdsInput,
  PlanoAdsOutput,
  SimularInput,
  SimularOutput,
} from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

type EconomiaCustoProntoEntrada = {
  precoCentavos: number;
  custoCentavos: number;
  canal: AnuncioMarketplace;
  tempoHoras: number;
};

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async calcular(input: CalcularInput): Promise<CalculoSaida> {
    const filamento = await this.resolverFilamento(input);
    const parametros = await this.carregarParametros();
    const tabelaShopee = await this.carregarTabelaShopee();
    const tabelaMl = await this.carregarTabelaMl();

    return calcularProduto({
      pesoG: input.pesoG,
      tempoH: input.tempoH,
      impressora: input.impressora,
      filamento,
      embalagemCentavos: input.embalagemCentavos,
      custoInsumosCentavos: input.custoInsumosCentavos ?? 0,
      precoCentavos: input.precoCentavos,
      parametros,
      tabelaShopee,
      tabelaMercadoLivre: tabelaMl,
    });
  }

  async simular(input: SimularInput): Promise<SimularOutput> {
    const produto = await this.prisma.produto.findUnique({
      where: { id: input.produtoId },
      include: { filamento: true },
    });
    if (!produto) throw new NotFoundException(`Produto ${input.produtoId} não existe`);

    const calculado = await this.calcular({
      filamentoId: produto.filamentoId,
      pesoG: Number(produto.pesoG),
      tempoH: Number(produto.tempoH),
      impressora: produto.impressora,
      embalagemCentavos: produto.embalagemCentavos,
      precoCentavos: produto.precoCentavos,
    });

    const liquidoUnitario =
      produto.canalPrincipal === 'SHOPEE'
        ? calculado.liquidoShopeeCentavos
        : produto.canalPrincipal === 'ML'
          ? calculado.liquidoMlCentavos
          : calculado.liquidoSiteCentavos;

    return simularCenario({
      horasPorDia: input.horasPorDia,
      dias: input.dias,
      utilizacaoPct: input.utilizacaoPct,
      numeroImpressoras: input.numeroImpressoras,
      tempoUnitarioH: Number(produto.tempoH),
      precoCentavos: produto.precoCentavos,
      liquidoUnitarioCentavos: liquidoUnitario,
    });
  }

  /**
   * Plano de anúncios (Teste + Escalonamento). Stateless: o cliente já calculou a
   * economia (precoCentavos + líquido do canal) e manda como margem de contribuição.
   * `input.params` parcial sobrescreve os defaults globais do Parametro.
   */
  async planoAds(input: PlanoAdsInput): Promise<PlanoAdsOutput> {
    const defaults = await this.carregarParamsAds();
    const params: ParamsAds = { ...defaults, ...input.params };
    return calcularPlanoAds({
      precoCentavos: input.precoCentavos,
      margemContribuicaoCentavos: input.margemContribuicaoCentavos,
      params,
    });
  }

  private async carregarParamsAds(): Promise<ParamsAds> {
    const p = await this.prisma.parametro.findUnique({ where: { id: 1 } });
    if (!p) throw new NotFoundException('Parâmetros não inicializados (GET /api/parametros)');
    return {
      cpcMedioCentavos: p.adsCpcMedioCentavos,
      taxaRetornoPct: Number(p.adsTaxaRetornoPct),
      janelaTesteDias: p.adsJanelaTesteDias,
      nivelConfianca: p.adsNivelConfianca === 99 ? 99 : 95,
      fatorMargemEscala: Number(p.adsFatorMargemEscala),
      passoIncrementoPct: Number(p.adsPassoIncrementoPct),
      cadenciaIncrementoDias: p.adsCadenciaIncrementoDias,
      nDegraus: p.adsNDegraus,
      budgetDiarioMinimoCentavos: p.adsBudgetDiarioMinimoCentavos,
      tetoBudgetDiarioCentavos: p.adsTetoBudgetDiarioCentavos,
    };
  }

  private async resolverFilamento(input: CalcularInput): Promise<FilamentoPricing> {
    if (input.filamentoId) {
      const f = await this.prisma.filamento.findUnique({ where: { id: input.filamentoId } });
      if (!f) throw new NotFoundException(`Filamento ${input.filamentoId} não existe`);
      return {
        nome: f.nome,
        custoKgCentavos: f.custoKgCentavos,
        potenciaA1W: f.potenciaA1W,
        potenciaH2cW: f.potenciaH2cW,
      };
    }
    if (
      input.filamentoCustoKgCentavos == null ||
      input.filamentoPotenciaA1W == null ||
      input.filamentoPotenciaH2cW == null
    ) {
      throw new BadRequestException(
        'Forneça filamentoId OU filamentoCustoKgCentavos+filamentoPotenciaA1W+filamentoPotenciaH2cW',
      );
    }
    return {
      nome: 'custom',
      custoKgCentavos: input.filamentoCustoKgCentavos,
      potenciaA1W: input.filamentoPotenciaA1W,
      potenciaH2cW: input.filamentoPotenciaH2cW,
    };
  }

  private async carregarParametros(): Promise<ParametrosGlobais> {
    const p = await this.prisma.parametro.findUnique({ where: { id: 1 } });
    if (!p) throw new NotFoundException('Parâmetros não inicializados (GET /api/parametros)');
    return {
      tarifaKwhCentavos: p.tarifaKwhCentavos,
      vendedorShopee: p.vendedorShopee,
      emCampanhaShopee: p.emCampanhaShopee,
      adicionalCampanhaPct: Number(p.adicionalCampanhaPct),
      comissaoMlPct: Number(p.comissaoMlPct),
      impostoAtivo: p.impostoAtivo,
      impostoPct: Number(p.impostoPct),
      tiktokComissaoPlataformaPct: Number(p.tiktokComissaoPlataformaPct),
      tiktokTaxaSfpPct: Number(p.tiktokTaxaSfpPct),
      tiktokComissaoAfiliadoPct: Number(p.tiktokComissaoAfiliadoPct),
      tiktokTaxaPagamentoPct: Number(p.tiktokTaxaPagamentoPct),
    };
  }

  private async carregarTabelaShopee(): Promise<FaixaShopeePricing[]> {
    const rows = await this.prisma.taxaShopee.findMany({
      orderBy: { limInferiorCentavos: 'asc' },
    });
    return rows.map((r) => ({
      limInferiorCentavos: r.limInferiorCentavos,
      comissaoPct: Number(r.comissaoPct),
      fixaCnpjCentavos: r.fixaCnpjCentavos,
      fixaCpfBaixoCentavos: r.fixaCpfBaixoCentavos,
      fixaCpfAltoCentavos: r.fixaCpfAltoCentavos,
    }));
  }

  /**
   * Economia de um item cujo custo JÁ vem somado. `calcular()` não serve aqui: ele
   * parte de peso e filamento pra chegar no custo, e modelo de prospecção não tem
   * filamento nem insumo cadastrado — tem só o custo estimado pelo bot.
   *
   * Nada disso é persistido: taxa de marketplace e imposto vivem no Parametro e
   * mudam, então número congelado no banco viraria mentira silenciosa na tela.
   */
  async economiaDeCustoPronto(entrada: EconomiaCustoProntoEntrada): Promise<EconomiaModelo> {
    const { precoCentavos: preco, custoCentavos, canal, tempoHoras } = entrada;
    const parametros = await this.carregarParametros();
    const taxa = await this.taxaDoCanal(preco, canal, parametros);
    const imposto = parametros.impostoAtivo
      ? arredondarCentavos((preco * parametros.impostoPct) / 100)
      : 0;
    const liquido = preco - taxa - imposto - custoCentavos;

    return {
      canal,
      precoCentavos: preco,
      custoCentavos,
      taxaMarketplaceCentavos: taxa,
      impostoCentavos: imposto,
      liquidoCentavos: liquido,
      margemPct: preco === 0 ? 0 : (liquido / preco) * 100,
      lucroPorHoraCentavos: tempoHoras === 0 ? 0 : Math.round(liquido / tempoHoras),
    };
  }

  private async taxaDoCanal(
    precoCentavos: number,
    canal: AnuncioMarketplace,
    parametros: ParametrosGlobais,
  ): Promise<number> {
    if (canal === 'SHOPEE') {
      return taxaShopeeCentavos(precoCentavos, parametros, await this.carregarTabelaShopee());
    }
    if (canal === 'ML') {
      return taxaMercadoLivreCentavos(precoCentavos, parametros, await this.carregarTabelaMl());
    }
    return taxaTikTokCentavos(precoCentavos, parametros);
  }

  private async carregarTabelaMl(): Promise<FaixaMlPricing[]> {
    const rows = await this.prisma.taxaMercadoLivre.findMany({
      orderBy: { limInferiorCentavos: 'asc' },
    });
    return rows.map((r) => ({
      faixa: r.faixa as 'A' | 'B' | 'C' | 'D' | 'E',
      limInferiorCentavos: r.limInferiorCentavos,
      custoFixoCentavos: r.custoFixoCentavos,
      pctAlternativo: Number(r.pctAlternativo),
      comissaoCategoriaPct: Number(r.comissaoCategoriaPct),
    }));
  }
}
