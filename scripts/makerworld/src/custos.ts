// Estimativa de custo e margem para TRIAGEM. Réplica simplificada de `packages/pricing`.
//
// POR QUE DUPLICAR A FÓRMULA: este script roda isolado do monorepo (mesmo padrão do
// `scripts/shopee-affiliate`), então não importa `@mahou-hub/pricing`. A conta aqui serve
// só pra ordenar candidatos e cortar os inviáveis — o número que vale é o do Hub, calculado
// de novo quando o modelo virar Produto com filamento e embalagem reais.
//
// Parâmetros conferidos com os valores vivos do Hub em jun/2026. Se divergirem, o efeito
// é ordenação levemente diferente na triagem — nunca preço publicado errado.

const CUSTO_FILAMENTO_KG_CENTAVOS = 6586; // PLA branco Velvet Voolt, NF mai/2026 + frete
const TARIFA_KWH_CENTAVOS = 85;
const POTENCIA_A1_W = 100;
const EMBALAGEM_CENTAVOS = 200;
const IMPOSTO_SIMPLES_PCT = 6; // efetivo apurado, não os 4,5% da tabela

// Shopee vendedor CNPJ. O salto do fixo em R$80 (R$4 → R$16) é o motivo de a escada de
// preços abaixo parar em R$79,90: cruzar esse degrau sobe a taxa de ~R$19,80 pra ~R$27,20,
// e o fixo maior só compensa acima de ~R$200.
const SHOPEE_COMISSAO_PCT = 20;
const SHOPEE_FIXA_CENTAVOS = 400;
const TETO_FAIXA_BARATA_CENTAVOS = 7990;

/** Preços psicológicos usados na loja, todos abaixo do degrau de taxa. */
const ESCADA_PRECOS = [2490, 2990, 3490, 3990, 4490, 4990, 5990, 6990, 7490, 7990];

export interface CustoEstimado {
  custoFilamentoCentavos: number;
  custoEnergiaCentavos: number;
  custoEmbalagemCentavos: number;
  custoTotalCentavos: number;
}

/**
 * Custo de produção de uma unidade.
 *
 * @example custoDeProducao(60, 4) // 60g em 4h ≈ { custoTotalCentavos: 630 }
 */
export function custoDeProducao(gramas: number, horas: number): CustoEstimado {
  const custoFilamentoCentavos = Math.round((gramas / 1000) * CUSTO_FILAMENTO_KG_CENTAVOS);
  const custoEnergiaCentavos = Math.round((horas * POTENCIA_A1_W * TARIFA_KWH_CENTAVOS) / 1000);
  const custoTotalCentavos =
    custoFilamentoCentavos + custoEnergiaCentavos + EMBALAGEM_CENTAVOS;

  return {
    custoFilamentoCentavos,
    custoEnergiaCentavos,
    custoEmbalagemCentavos: EMBALAGEM_CENTAVOS,
    custoTotalCentavos,
  };
}

/** Sobra depois da Shopee e do Simples, para um preço de venda. */
export function liquidoShopeeCentavos(precoCentavos: number): number {
  const taxa = precoCentavos * (SHOPEE_COMISSAO_PCT / 100) + SHOPEE_FIXA_CENTAVOS;
  const imposto = precoCentavos * (IMPOSTO_SIMPLES_PCT / 100);
  return Math.round(precoCentavos - taxa - imposto);
}

/**
 * Menor preço da escada que atinge a margem alvo. Devolve `null` quando nem o teto
 * da faixa barata chega lá — sinal de que a peça é pesada ou lenta demais pra Shopee.
 */
export function precoParaMargem(
  custoTotalCentavos: number,
  margemAlvoPct = 40,
): number | null {
  for (const preco of ESCADA_PRECOS) {
    const margem = ((liquidoShopeeCentavos(preco) - custoTotalCentavos) / preco) * 100;
    if (margem >= margemAlvoPct) return preco;
  }
  return null;
}

export function margemPct(precoCentavos: number, custoTotalCentavos: number): number {
  if (precoCentavos <= 0) return 0;
  const lucro = liquidoShopeeCentavos(precoCentavos) - custoTotalCentavos;
  return Number(((lucro / precoCentavos) * 100).toFixed(1));
}

/**
 * Lucro por hora de impressora. É a métrica de fila: com uma A1 só, o que importa não é
 * a margem percentual, é quantos reais cada hora de máquina rende. Uma peça de 30% de
 * margem em 1h ganha de uma de 50% em 8h.
 */
export function lucroPorHoraCentavos(
  precoCentavos: number,
  custoTotalCentavos: number,
  horas: number,
): number {
  if (horas <= 0) return 0;
  return Math.round((liquidoShopeeCentavos(precoCentavos) - custoTotalCentavos) / horas);
}

export const TETO_PRECO_FAIXA_BARATA = TETO_FAIXA_BARATA_CENTAVOS;

/** Abaixo disso o anúncio não se sustenta sozinho: a taxa fixa de R$4 da Shopee mais o
 * frete comem a margem, e o comprador não paga preço de produto por uma peça minúscula. */
const GRAMAS_MINIMAS_POR_ANUNCIO = 18;
/** Teto de unidades num kit — acima disso vira encomenda, não anúncio de prateleira. */
const MAXIMO_POR_KIT = 12;

/**
 * Quantas unidades a peça precisa ter no anúncio pra virar um produto de verdade.
 *
 * Peça pequena não é produto avulso na Shopee — é kit. Isso não é escolha estética:
 * é o que o mercado faz (multipacks de flexi dominam o topo do Etsy) e o que a tabela
 * de taxas obriga. Sem isso, a triagem enche de chaveiro de 1g com "R$70/hora" fictícios.
 *
 * @example unidadesPorAnuncio(2)  // 9 — brinco de 2g vende em cartela
 * @example unidadesPorAnuncio(45) // 1 — peça já se sustenta sozinha
 */
export function unidadesPorAnuncio(gramasPorUnidade: number): number {
  if (gramasPorUnidade <= 0) return 1;
  if (gramasPorUnidade >= GRAMAS_MINIMAS_POR_ANUNCIO) return 1;
  return Math.min(MAXIMO_POR_KIT, Math.ceil(GRAMAS_MINIMAS_POR_ANUNCIO / gramasPorUnidade));
}
