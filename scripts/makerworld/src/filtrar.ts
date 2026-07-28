// Etapa 3 — corta o que não vira produto e pontua o resto por regra.
//
// Tudo aqui é determinístico e grátis. A IA só olha o que sobreviver, então cada corte
// deste arquivo é economia direta de orçamento de avaliação. Os limites vêm da realidade
// da produção da Mahou (uma A1, fila compartilhada) e da tabela de taxas da Shopee.

import { ler, escrever, ARQUIVOS } from './armazenamento.js';
import {
  custoDeProducao,
  lucroPorHoraCentavos,
  margemPct,
  precoParaMargem,
  unidadesPorAnuncio,
} from './custos.js';
import { nichoPorChave } from './nichos.js';
import type { ModeloCandidato, ModeloEnriquecido } from './tipos.js';

export interface Limites {
  /** Abaixo disso o modelo não provou tração — nem o autor conseguiu público. */
  downloadsMinimos: number;
  /** Peça pesada come filamento e estoura o preço ótimo da Shopee. */
  gramasMaximas: number;
  /** Com uma impressora só, peça longa trava a fila e mata o lucro/hora. */
  horasMaximas: number;
  margemMinimaPct: number;
  /** Piso de reais por hora de máquina. Abaixo disso não vale ocupar a A1. */
  lucroPorHoraMinimoCentavos: number;
}

export const LIMITES_PADRAO: Limites = {
  downloadsMinimos: 300,
  gramasMaximas: 200,
  horasMaximas: 8,
  margemMinimaPct: 35,
  lucroPorHoraMinimoCentavos: 400,
};

export interface ResumoFiltro {
  entraram: number;
  aprovados: number;
  cortes: Record<string, number>;
}

/**
 * Score 0..100 por regra pura — ordena a fila de avaliação visual, não substitui a IA.
 * Composição: tração 35, lucro por hora 30, peso do nicho 20, prova social 15.
 * Foto real do autor entra como bônus porque encurta o trabalho de fotografar depois.
 */
function pontuar(modelo: ModeloEnriquecido, lucroHora: number, margem: number): number {
  const tracao = Math.min(modelo.downloads / 5000, 1) * 35;
  const rendimento = Math.min(lucroHora / 1500, 1) * 30;

  const pesoNicho =
    Math.max(
      0,
      ...modelo.nichosCandidatos.map((c) => nichoPorChave(c)?.pesoComercial ?? 0),
    ) * 20;

  // Coleção vale mais que like: salvar um modelo é intenção de imprimir, curtir é cortesia.
  const provaSocial = Math.min((modelo.colecoes * 2 + modelo.likes) / 8000, 1) * 15;

  // Sem bônus por foto real: o `isRealLifePhoto` da API marca só ~10% do acervo e erra
  // pra menos com frequência (revisões de 2026-07-28 acharam foto real em dezenas de
  // modelos marcados como render). Premiar por esse campo premiava o ruído.
  const penalidadeMargem = margem < 45 ? -5 : 0;

  const bruto = tracao + rendimento + pesoNicho + provaSocial + penalidadeMargem;
  return Math.max(0, Math.min(100, Math.round(bruto)));
}

/**
 * Aplica os limites e grava `candidatos.jsonl` ordenado por score.
 *
 * @example await filtrar({ ...LIMITES_PADRAO, horasMaximas: 5 })
 */
export async function filtrar(limites: Limites = LIMITES_PADRAO): Promise<ResumoFiltro> {
  const enriquecidos = await ler<ModeloEnriquecido>(ARQUIVOS.enriquecidos);
  const cortes: Record<string, number> = {
    semPerfilDeImpressao: 0,
    tracaoBaixa: 0,
    pesado: 0,
    lento: 0,
    semImagem: 0,
    margemInsuficiente: 0,
    lucroPorHoraBaixo: 0,
  };

  const aprovados: ModeloCandidato[] = [];

  for (const modelo of enriquecidos) {
    if (modelo.downloads < limites.downloadsMinimos) {
      cortes.tracaoBaixa = (cortes.tracaoBaixa ?? 0) + 1;
      continue;
    }
    if (modelo.imagens.length === 0) {
      cortes.semImagem = (cortes.semImagem ?? 0) + 1;
      continue;
    }

    const perfil = modelo.perfilEscolhido;
    if (!perfil) {
      cortes.semPerfilDeImpressao = (cortes.semPerfilDeImpressao ?? 0) + 1;
      continue;
    }

    // Peça pequena vira kit antes de ser avaliada — os limites de peso e tempo valem
    // sobre o ANÚNCIO, que é o que de fato ocupa a impressora e vai pra caixa.
    const unidades = unidadesPorAnuncio(perfil.gramas);
    const gramasAnuncio = perfil.gramas * unidades;
    const horasAnuncio = Number((perfil.horas * unidades).toFixed(2));

    if (gramasAnuncio > limites.gramasMaximas) {
      cortes.pesado = (cortes.pesado ?? 0) + 1;
      continue;
    }
    if (horasAnuncio > limites.horasMaximas) {
      cortes.lento = (cortes.lento ?? 0) + 1;
      continue;
    }

    const custo = custoDeProducao(gramasAnuncio, horasAnuncio);
    const preco = precoParaMargem(custo.custoTotalCentavos, limites.margemMinimaPct);
    if (preco === null) {
      cortes.margemInsuficiente = (cortes.margemInsuficiente ?? 0) + 1;
      continue;
    }

    const lucroHora = lucroPorHoraCentavos(preco, custo.custoTotalCentavos, horasAnuncio);
    if (lucroHora < limites.lucroPorHoraMinimoCentavos) {
      cortes.lucroPorHoraBaixo = (cortes.lucroPorHoraBaixo ?? 0) + 1;
      continue;
    }

    const margem = margemPct(preco, custo.custoTotalCentavos);
    aprovados.push({
      ...modelo,
      estimativa: {
        gramas: gramasAnuncio,
        horas: horasAnuncio,
        unidadesPorKit: unidades,
        gramasPorUnidade: perfil.gramas,
        ...custo,
        precoSugeridoCentavos: preco,
        margemEstimadaPct: margem,
        lucroPorHoraCentavos: lucroHora,
      },
      scoreObjetivo: pontuar(modelo, lucroHora, margem),
    });
  }

  aprovados.sort((a, b) => b.scoreObjetivo - a.scoreObjetivo);
  await escrever(ARQUIVOS.candidatos, aprovados);

  return { entraram: enriquecidos.length, aprovados: aprovados.length, cortes };
}
