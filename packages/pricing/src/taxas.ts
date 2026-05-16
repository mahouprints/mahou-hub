import type {
  FaixaMercadoLivre,
  FaixaShopee,
  ParametrosGlobais,
  VendedorShopee,
} from './types';
import { arredondarCentavos } from './money';

/**
 * Localiza a faixa Shopee aplicável ao preço (última faixa cujo limInferior é <= preço).
 * Tabela vem em ordem crescente, espelhando linhas 4-8 da aba Parâmetros.
 */
function faixaShopeeParaPreco(precoCentavos: number, tabela: FaixaShopee[]): FaixaShopee {
  const ordenada = [...tabela].sort((a, b) => a.limInferiorCentavos - b.limInferiorCentavos);
  let escolhida: FaixaShopee | null = null;
  for (const faixa of ordenada) {
    if (faixa.limInferiorCentavos <= precoCentavos) {
      escolhida = faixa;
    } else {
      break;
    }
  }
  if (!escolhida) {
    throw new Error(
      `Nenhuma faixa Shopee para preço ${precoCentavos} centavos; menor limite é ${ordenada[0]?.limInferiorCentavos}`,
    );
  }
  return escolhida;
}

function fixaShopeePorTipo(faixa: FaixaShopee, tipo: VendedorShopee): number {
  switch (tipo) {
    case 'CNPJ':
      return faixa.fixaCnpjCentavos;
    case 'CPF_BAIXO':
      return faixa.fixaCpfBaixoCentavos;
    case 'CPF_ALTO':
      return faixa.fixaCpfAltoCentavos;
  }
}

/**
 * Taxa total cobrada pela Shopee sobre uma venda: comissão variável + fixa + campanha.
 * Réplica do cálculo na coluna M (Liq. Shopee) da aba Produtos, isolado da composição
 * do líquido. Campanha soma `adicionalCampanhaPct` à comissão.
 */
export function taxaShopeeCentavos(
  precoCentavos: number,
  parametros: ParametrosGlobais,
  tabela: FaixaShopee[],
): number {
  const faixa = faixaShopeeParaPreco(precoCentavos, tabela);
  const pctEfetivo =
    faixa.comissaoPct + (parametros.emCampanhaShopee ? parametros.adicionalCampanhaPct : 0);
  const comissao = precoCentavos * (pctEfetivo / 100);
  const fixa = fixaShopeePorTipo(faixa, parametros.vendedorShopee);
  return arredondarCentavos(comissao + fixa);
}

function faixaMlParaPreco(
  precoCentavos: number,
  tabela: FaixaMercadoLivre[],
): FaixaMercadoLivre {
  const ordenada = [...tabela].sort((a, b) => a.limInferiorCentavos - b.limInferiorCentavos);
  let escolhida: FaixaMercadoLivre | null = null;
  for (const faixa of ordenada) {
    if (faixa.limInferiorCentavos <= precoCentavos) {
      escolhida = faixa;
    } else {
      break;
    }
  }
  if (!escolhida) {
    throw new Error(`Nenhuma faixa Mercado Livre para preço ${precoCentavos} centavos`);
  }
  return escolhida;
}

/**
 * Taxa total do Mercado Livre: comissão da categoria + custo fixo OU percentual alternativo
 * (o que for maior). Réplica da coluna N (Liq. ML) da aba Produtos.
 */
export function taxaMercadoLivreCentavos(
  precoCentavos: number,
  parametros: ParametrosGlobais,
  tabela: FaixaMercadoLivre[],
): number {
  const faixa = faixaMlParaPreco(precoCentavos, tabela);
  const comissao = precoCentavos * (parametros.comissaoMlPct / 100);
  const alternativo = precoCentavos * (faixa.pctAlternativo / 100);
  const fixaOuAlternativo = Math.max(faixa.custoFixoCentavos, alternativo);
  return arredondarCentavos(comissao + fixaOuAlternativo);
}
