import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calcularProduto,
  simularCenario,
  type CalculoSaida,
  type FaixaMercadoLivre as FaixaMlPricing,
  type FaixaShopee as FaixaShopeePricing,
  type Filamento as FilamentoPricing,
  type ParametrosGlobais,
} from '@mahou-hub/pricing';
import type { CalcularInput, SimularInput, SimularOutput } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

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
