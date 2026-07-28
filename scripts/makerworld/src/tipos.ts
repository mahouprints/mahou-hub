// Formato dos registros que atravessam o pipeline. Cada etapa acrescenta campos
// ao registro anterior — nada é reescrito, pra que uma etapa possa ser reprocessada
// sem refazer a coleta (que é a parte lenta).

import type { VeredictoLicenca } from './licenca.js';

/** Saída de `coletar` — o que a listagem devolve, sem enriquecimento. */
export interface ModeloColetado {
  id: number;
  titulo: string;
  slug: string;
  url: string;
  capa: string;
  downloads: number;
  likes: number;
  colecoes: number;
  impressoes: number;
  comentarios: number;
  criadoEm: string;
  autor: string;
  tags: string[];
  licenca: string;
  licencaVeredicto: VeredictoLicenca;
  licencaObrigacao: string;
  /** Subcategorias do MakerWorld em que o modelo apareceu durante a varredura. */
  categorias: number[];
  /** Chaves de nicho derivadas das categorias — palpite inicial, a IA confirma depois. */
  nichosCandidatos: string[];
}

/** Um perfil de impressão já normalizado pro que interessa ao custo. */
export interface PerfilNormalizado {
  titulo: string;
  gramas: number;
  horas: number;
  cores: number;
  precisaAms: boolean;
  downloads: number;
}

/** Saída de `enriquecer` — soma peso, tempo e imagens ao registro coletado. */
export interface ModeloEnriquecido extends ModeloColetado {
  resumo: string;
  /** O perfil mais barato de produzir entre os que o autor publicou. */
  perfilEscolhido: PerfilNormalizado | null;
  perfis: PerfilNormalizado[];
  /** URLs de imagem, com as fotos reais primeiro (valem mais que render pra julgar). */
  imagens: string[];
  temFotoReal: boolean;
  geradoPorIa: boolean;
}

/** Custo e preço estimados — calculados por `filtrar`, antes de qualquer IA olhar. */
export interface EstimativaFinanceira {
  /** Gramas e horas do ANÚNCIO (unidade × `unidadesPorKit`), não da peça isolada. */
  gramas: number;
  horas: number;
  /** Quantas peças o anúncio vende junto. 1 = peça avulsa. */
  unidadesPorKit: number;
  gramasPorUnidade: number;
  custoFilamentoCentavos: number;
  custoEnergiaCentavos: number;
  custoEmbalagemCentavos: number;
  custoTotalCentavos: number;
  /** Preço sugerido dentro da faixa ótima da Shopee (degrau de taxa em R$80). */
  precoSugeridoCentavos: number;
  margemEstimadaPct: number;
  /** Reais de lucro por hora de impressora — a métrica que decide o que entra na fila. */
  lucroPorHoraCentavos: number;
}

/** Saída de `filtrar` — sobreviventes com estimativa financeira, prontos pra avaliação. */
export interface ModeloCandidato extends ModeloEnriquecido {
  estimativa: EstimativaFinanceira;
  /** 0..100 calculado por regra (tração + margem + peso do nicho). Não é a nota da IA. */
  scoreObjetivo: number;
  /** Caminhos locais das imagens já redimensionadas, preenchido por `imagens`. */
  imagensLocais?: string[];
}

export type VeredictoIa = 'APROVADO' | 'TALVEZ' | 'REPROVADO';

/** O que o avaliador (Haiku na triagem, Opus na curadoria) devolve por modelo. */
export interface AvaliacaoIa {
  id: number;
  veredicto: VeredictoIa;
  /** 0..100 — apelo comercial do produto na foto, não qualidade do modelo 3D. */
  nota: number;
  nicho: string;
  /** Uma frase dizendo por quê. É o que o Gabriel lê na revisão. */
  justificativa: string;
  /** Riscos detectados na imagem: IP de terceiros, precisa suporte, peça frágil, etc. */
  alertas: string[];
  avaliadoPor: 'HAIKU' | 'OPUS';
}

/** Registro final que sobe pro Mahou Hub. */
export interface ModeloAvaliado extends ModeloCandidato {
  triagem: AvaliacaoIa;
  curadoria?: AvaliacaoIa;
}
