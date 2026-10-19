import type { CalculoEntrada, CalculoSaida } from './types';
import { custoEnergiaCentavos, custoFilamentoCentavos, custoFilamentosCentavos } from './custos';
import { taxaShopeeCentavos, taxaTikTokCentavos } from './taxas';
import { arredondarCentavos } from './money';

/**
 * Calcula custos, taxas e líquido por canal para um produto (hipotético ou cadastrado).
 * É a função usada pela Calculadora (`/calculadora`) e pelo form de Produto.
 *
 * @example
 *   calcularProduto({
 *     pesoG: 50, tempoH: 2, impressora: 'A1', filamento, embalagemCentavos: 150,
 *     precoCentavos: 3500, parametros, tabelaShopee,
 *     mercadoLivre: { tarifaCentavos: 525, freteCentavos: 650 },
 *   })
 */
export function calcularProduto(entrada: CalculoEntrada): CalculoSaida {
  const {
    pesoG,
    tempoH,
    impressora,
    filamento,
    embalagemCentavos,
    custoInsumosCentavos = 0,
    precoCentavos,
    parametros,
  } = entrada;

  const custoFilamento = entrada.filamentos?.length
    ? custoFilamentosCentavos(entrada.filamentos)
    : custoFilamentoCentavos(pesoG, filamento.custoKgCentavos);
  const custoEnergia = custoEnergiaCentavos(
    tempoH,
    filamento,
    impressora,
    parametros.tarifaKwhCentavos,
  );
  const custoTotalProducao =
    custoFilamento + custoEnergia + embalagemCentavos + custoInsumosCentavos;

  const imposto = parametros.impostoAtivo
    ? arredondarCentavos(precoCentavos * (parametros.impostoPct / 100))
    : 0;

  const taxaShopee = taxaShopeeCentavos(precoCentavos, parametros, entrada.tabelaShopee);
  const taxaMl = entrada.mercadoLivre?.tarifaCentavos ?? null;
  const freteMl = entrada.mercadoLivre?.freteCentavos ?? null;
  const taxaTikTok = taxaTikTokCentavos(precoCentavos, parametros);

  const liquidoShopee = precoCentavos - custoTotalProducao - imposto - taxaShopee;
  const liquidoMl =
    taxaMl === null || freteMl === null
      ? null
      : precoCentavos - custoTotalProducao - imposto - taxaMl - freteMl;
  const liquidoSite = precoCentavos - custoTotalProducao - imposto;
  const liquidoTikTok = precoCentavos - custoTotalProducao - imposto - taxaTikTok;

  return {
    custoFilamentoCentavos: custoFilamento,
    custoEnergiaCentavos: custoEnergia,
    custoTotalProducaoCentavos: custoTotalProducao,
    impostoCentavos: imposto,
    taxaShopeeCentavos: taxaShopee,
    taxaMlCentavos: taxaMl,
    freteMlCentavos: freteMl,
    custosMlStatus: liquidoMl === null ? 'PENDENTE' : 'COTADO',
    taxaTikTokCentavos: taxaTikTok,
    liquidoShopeeCentavos: liquidoShopee,
    liquidoMlCentavos: liquidoMl,
    liquidoSiteCentavos: liquidoSite,
    liquidoTikTokCentavos: liquidoTikTok,
    margemShopee: precoCentavos === 0 ? 0 : liquidoShopee / precoCentavos,
    margemMl: liquidoMl === null ? null : precoCentavos === 0 ? 0 : liquidoMl / precoCentavos,
    margemSite: precoCentavos === 0 ? 0 : liquidoSite / precoCentavos,
    margemTikTok: precoCentavos === 0 ? 0 : liquidoTikTok / precoCentavos,
    lucroPorHoraShopeeCentavos: tempoH === 0 ? 0 : arredondarCentavos(liquidoShopee / tempoH),
    lucroPorHoraMlCentavos:
      liquidoMl === null ? null : tempoH === 0 ? 0 : arredondarCentavos(liquidoMl / tempoH),
    lucroPorHoraSiteCentavos: tempoH === 0 ? 0 : arredondarCentavos(liquidoSite / tempoH),
    lucroPorHoraTikTokCentavos: tempoH === 0 ? 0 : arredondarCentavos(liquidoTikTok / tempoH),
  };
}
