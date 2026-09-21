import type { ModeloDetalhe, ModeloListagem, PerfilImpressao } from './client.js';
import { urlDoModelo } from './client.js';
import { custoDeProducao, lucroPorHoraCentavos, margemPct, precoParaMargem } from './custos.js';
import { analisarLicenca } from './licenca.js';

export const LIMITES_FLEXI = { gramas: 60, horas: 2 } as const;
export interface LimitesFlexi {
  gramas: number;
  horas: number;
}

export interface PerfilFlexi {
  id: string | null;
  indice: number;
  titulo: string;
  gramas: number;
  horas: number;
  downloads: number;
  materiais: number | null;
  cores: number | null;
  precisaAms: boolean | null;
  impressora: string | null;
  bicoMm: number | null;
  placas: number | null;
  imagens: string[];
  temFotoReal: boolean;
}

export interface CandidatoFlexi {
  modelo: ModeloListagem;
  licenca: string;
  autor: string;
  url: string;
  perfil: PerfilFlexi;
  scoreObjetivo: number;
  coletadoEm: string | null;
  arquivoOrigem?: string;
  arquivoModificadoEm?: string;
  pendencias: string[];
}

export type SelecaoFlexi = { candidato: CandidatoFlexi } | { motivos: string[] };

function numeroPositivo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0;
}

function imagemHttp(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  try {
    return ['https:', 'http:'].includes(new URL(valor).protocol);
  } catch {
    return false;
  }
}

/** Reconhece candidatos por título/tags, sem alegar avaliação visual. Ex.: "Flexi dragon". */
export function pareceFlexi(titulo: string, tags: string[] = []): boolean {
  return /\b(flexi\w*|articulat\w*|articulad\w*|jointed|print[ -]in[ -]place)\b/i.test(
    [titulo, ...tags].join(' '),
  );
}

function normalizarPerfil(perfil: PerfilImpressao, indice: number): PerfilFlexi | null {
  if (!numeroPositivo(perfil.weight) || !numeroPositivo(perfil.prediction)) return null;
  const fotos = Array.isArray(perfil.pictures) ? perfil.pictures : [];
  const imagens = fotos
    .filter((foto) => imagemHttp(foto.url))
    .sort((a, b) => Number(b.isRealLifePhoto === 1) - Number(a.isRealLifePhoto === 1));
  return {
    id: perfil.id === undefined || perfil.id === null ? null : String(perfil.id),
    indice,
    titulo: perfil.title || `Perfil ${indice + 1}`,
    gramas: perfil.weight,
    horas: perfil.prediction / 3600,
    downloads:
      Number.isFinite(perfil.downloadCount) && perfil.downloadCount >= 0 ? perfil.downloadCount : 0,
    materiais:
      numeroPositivo(perfil.materialCnt) && Number.isInteger(perfil.materialCnt)
        ? perfil.materialCnt
        : null,
    cores:
      numeroPositivo(perfil.materialColorCnt) && Number.isInteger(perfil.materialColorCnt)
        ? perfil.materialColorCnt
        : null,
    precisaAms: typeof perfil.needAms === 'boolean' ? perfil.needAms : null,
    impressora: perfil.extention?.modelInfo?.compatibility?.devProductName ?? null,
    bicoMm: perfil.extention?.modelInfo?.compatibility?.nozzleDiameter ?? null,
    placas: perfil.extention?.modelInfo?.plates?.length ?? null,
    imagens: [
      ...new Set([
        ...imagens.map((foto) => foto.url),
        ...(imagemHttp(perfil.cover) ? [perfil.cover] : []),
      ]),
    ].slice(0, 4),
    temFotoReal: imagens.some((foto) => foto.isRealLifePhoto === 1),
  };
}

function compararPerfis(a: PerfilFlexi, b: PerfilFlexi): number {
  const purgaConhecida = Number(a.precisaAms !== false) - Number(b.precisaAms !== false);
  const multicor = Number((b.cores ?? 0) > 1) - Number((a.cores ?? 0) > 1);
  const bicoPadrao = Number(b.bicoMm === 0.4) - Number(a.bicoMm === 0.4);
  return (
    purgaConhecida ||
    multicor ||
    bicoPadrao ||
    b.downloads - a.downloads ||
    a.horas - b.horas ||
    a.gramas - b.gramas
  );
}

/** Seleciona um único perfil; nunca combina foto AMS com o custo de outro. Ex.: selecionarFlexi(hit, detalhe). */
export function selecionarFlexi(
  modelo: ModeloListagem,
  detalhe: ModeloDetalhe,
  limites: LimitesFlexi = LIMITES_FLEXI,
): SelecaoFlexi {
  if (
    !Number.isSafeInteger(detalhe.id) ||
    detalhe.id <= 0 ||
    detalhe.id !== modelo.id ||
    !detalhe.title?.trim()
  ) {
    return { motivos: ['DETALHE_INVALIDO'] };
  }
  if (!analisarLicenca(detalhe.license).vendavel)
    return { motivos: ['LICENCA_NAO_COMERCIAL_OU_DESCONHECIDA'] };
  if (modelo.nsfw || detalhe.nsfw) return { motivos: ['CONTEUDO_ADULTO'] };
  if (!pareceFlexi(detalhe.title || modelo.title, modelo.tags))
    return { motivos: ['SEM_INDICIO_FLEXI'] };
  const perfis = (detalhe.instances ?? []).map(normalizarPerfil).filter((p) => p !== null);
  if (perfis.length === 0) return { motivos: ['SEM_PESO_OU_TEMPO_VALIDO'] };
  const viaveis = perfis.filter((p) => p.gramas <= limites.gramas && p.horas <= limites.horas);
  if (viaveis.length === 0) return { motivos: ['NENHUM_PERFIL_DENTRO_DOS_LIMITES'] };
  const perfil = viaveis.filter((p) => p.imagens.length > 0).sort(compararPerfis)[0];
  if (!perfil) return { motivos: ['SEM_IMAGEM_DO_PERFIL_VIAVEL'] };
  const url = urlDoModelo(modelo.id, detalhe.slug || modelo.slug);
  return {
    candidato: {
      modelo: { ...modelo, title: detalhe.title || modelo.title },
      licenca: detalhe.license,
      autor: detalhe.designCreator?.name ?? modelo.designCreator?.name ?? '',
      url: perfil.id ? `${url}#profileId-${encodeURIComponent(perfil.id)}` : url,
      perfil,
      scoreObjetivo: pontuarPerfil(perfil, limites),
      coletadoEm: new Date().toISOString(),
      pendencias: perfil.precisaAms === false ? [] : ['PURGA_NAO_INFORMADA'],
    },
  };
}

function pontuarPerfil(perfil: PerfilFlexi, limites: LimitesFlexi): number {
  const multicolor = (perfil.cores ?? 0) > 1 ? 50 : 0;
  const rapidez = 25 * (1 - perfil.horas / limites.horas);
  const leveza = 25 * (1 - perfil.gramas / limites.gramas);
  return Math.round(multicolor + rapidez + leveza);
}

/** Converte evidência do perfil para o contrato existente. Ex.: paraPayloadFlexi(candidato). */
export function paraPayloadFlexi(candidato: CandidatoFlexi) {
  const { modelo, perfil } = candidato;
  const licenca = analisarLicenca(candidato.licenca);
  const custo = custoDeProducao(perfil.gramas, perfil.horas);
  const preco = precoParaMargem(custo.custoTotalCentavos);
  if (preco === null) throw new Error(`Modelo ${modelo.id}: custo fora da escada de preços.`);
  const cores = perfil.cores === null ? 'cores desconhecidas' : `${perfil.cores} cores declaradas`;
  if (candidato.pendencias.length > 0)
    throw new Error(`Modelo ${modelo.id}: há pendências de consumo.`);
  return {
    externalId: String(modelo.id),
    titulo: modelo.title,
    url: candidato.url,
    autor: candidato.autor,
    imagemUrl: perfil.imagens[0]!,
    downloads: modelo.downloadCount ?? 0,
    curtidas: modelo.likeCount ?? 0,
    colecoes: modelo.collectionCount ?? 0,
    licenca: candidato.licenca,
    licencaVeredicto: licenca.veredicto,
    licencaObrigacao: licenca.obrigacao,
    nicho: 'FLEXI_ARTICULADO' as const,
    pesoGramas: perfil.gramas,
    tempoHoras: perfil.horas,
    unidadesPorKit: 1,
    custoEstimadoCentavos: custo.custoTotalCentavos,
    precoSugeridoCentavos: preco,
    margemEstimadaPct: margemPct(preco, custo.custoTotalCentavos),
    lucroPorHoraCentavos: lucroPorHoraCentavos(preco, custo.custoTotalCentavos, perfil.horas),
    scoreObjetivo: candidato.scoreObjetivo,
    // O contrato exige número. Zero é sentinela, exibida como "Sem avaliação" pela tag abaixo.
    notaIa: 0,
    veredictoIa: 'TALVEZ' as const,
    justificativaIa:
      `Triagem automática por metadados, sem avaliação visual/IA. ` +
      `Perfil ${perfil.id ?? `índice ${perfil.indice + 1}`} — ${perfil.titulo}: ` +
      `${perfil.gramas} g, ${(perfil.horas * 60).toFixed(1)} min, ${cores}. ` +
      `Impressora: ${perfil.impressora ?? 'não informada'}, bico: ${perfil.bicoMm ?? 'não informado'} mm; ` +
      `${perfil.placas ?? 'quantidade desconhecida de'} placas. ` +
      `Peso, tempo e imagem pertencem ao mesmo perfil. Total publicado do trabalho, sem dividir por peças/placas. ` +
      (candidato.coletadoEm
        ? `Consulta à API em ${candidato.coletadoEm}.`
        : `Dados de arquivo salvo em ${candidato.arquivoModificadoEm}; sem atualização nesta execução.`),
    alertas: [
      'SEM_AVALIACAO_VISUAL',
      'ESTIMATIVA_DO_PERFIL_CONFIRMAR_PURGA_E_PLACAS',
      'CUSTOS_E_PRECOS_ESTIMADOS',
      ...(perfil.cores === null ? ['CORES_DESCONHECIDAS'] : []),
      ...(perfil.bicoMm !== null && perfil.bicoMm !== 0.4 ? ['NOZZLE_DIFERENTE_0_4'] : []),
      ...(/\b(sprunki|minecraft|jurassic (?:park|world))\b/i.test(
        [modelo.title, ...(modelo.tags ?? [])].join(' '),
      )
        ? ['IP_TERCEIRO']
        : []),
    ],
    tags: [
      ...new Set([
        'flexi-60g',
        'SEM_AVALIACAO_VISUAL',
        ...((perfil.cores ?? 0) > 1 ? ['MULTICOR_PROVAVEL'] : []),
        ...(modelo.tags ?? []),
      ]),
    ].slice(0, 15),
    temFotoReal: perfil.temFotoReal,
  };
}

export type PayloadFlexi = ReturnType<typeof paraPayloadFlexi>;
