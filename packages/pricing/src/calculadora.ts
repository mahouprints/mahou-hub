import type { CalculoEntrada, CalculoSaida } from './types';
import { custoEnergiaCentavos, custoFilamentoCentavos } from './custos';
import { taxaMercadoLivreCentavos, taxaShopeeCentavos } from './taxas';
import { arredondarCentavos } from './money';

/**
 * Calcula custos, taxas e líquido por canal para um produto (hipotético ou cadastrado).
 * É a função usada pela Calculadora (`/calculadora`) e pelo form de Produto.
 *
 * @example
 *   calcularProduto({
 *     pesoG: 50, tempoH: 2, impressora: 'A1', filamento, embalagemCentavos: 150,
 *     precoCentavos: 3500, parametros, tabelaShopee, tabelaMercadoLivre,
 *   })
 */
export function calcularProduto(entrada: CalculoEntrada): CalculoSaida {
  const { pesoG, tempoH, impressora, filamento, embalagemCentavos, precoCentavos, parametros } =
    entrada;

  const custoFilamento = custoFilamentoCentavos(pesoG, filamento.custoKgCentavos);
  const custoEnergia = custoEnergiaCentavos(
    tempoH,
    filamento,
    impressora,
    parametros.tarifaKwhCentavos,
  );
  const custoTotalProducao = custoFilamento + custoEnergia + embalagemCentavos;

  const imposto = parametros.impostoAtivo
    ? arredondarCentavos(precoCentavos * (parametros.impostoPct / 100))
    : 0;

  const taxaShopee = taxaShopeeCentavos(precoCentavos, parametros, entrada.tabelaShopee);
  const taxaMl = taxaMercadoLivreCentavos(precoCentavos, parametros, entrada.tabelaMercadoLivre);

  const liquidoShopee = precoCentavos - custoTotalProducao - imposto - taxaShopee;
  const liquidoMl = precoCentavos - custoTotalProducao - imposto - taxaMl;
  const liquidoSite = precoCentavos - custoTotalProducao - imposto;

  return {
    custoFilamentoCentavos: custoFilamento,
    custoEnergiaCentavos: custoEnergia,
    custoTotalProducaoCentavos: custoTotalProducao,
    impostoCentavos: imposto,
    taxaShopeeCentavos: taxaShopee,
    taxaMlCentavos: taxaMl,
    liquidoShopeeCentavos: liquidoShopee,
    liquidoMlCentavos: liquidoMl,
    liquidoSiteCentavos: liquidoSite,
    margemShopee: precoCentavos === 0 ? 0 : liquidoShopee / precoCentavos,
    margemMl: precoCentavos === 0 ? 0 : liquidoMl / precoCentavos,
    margemSite: precoCentavos === 0 ? 0 : liquidoSite / precoCentavos,
    lucroPorHoraShopeeCentavos: tempoH === 0 ? 0 : arredondarCentavos(liquidoShopee / tempoH),
    lucroPorHoraMlCentavos: tempoH === 0 ? 0 : arredondarCentavos(liquidoMl / tempoH),
    lucroPorHoraSiteCentavos: tempoH === 0 ? 0 : arredondarCentavos(liquidoSite / tempoH),
  };
}
