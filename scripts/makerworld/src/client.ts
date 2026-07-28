// Cliente da API pública do MakerWorld (bambulab). Sem autenticação — os dois endpoints
// abaixo respondem a GET anônimo. Descobertos em 2026-07-27 inspecionando o tráfego da
// SPA; não há documentação oficial, então trate mudança de shape como esperada.
//
//   busca:    /api/v1/search-service/select/design?categories=&orderBy=&limit=&offset=
//   detalhe:  /api/v1/design-service/design/<id>
//
// Deliberadamente NÃO usamos `/_next/data/<BUILD_ID>/...` (a outra via de listagem):
// o BUILD_ID muda a cada deploy do MakerWorld e quebraria o bot sem aviso.

const BASE = 'https://makerworld.com';

// Navegador real: a Cloudflare na frente do MakerWorld devolve 403 pra User-Agent de bot.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Teto de janela do Elasticsearch por trás da busca — offset além disso devolve lista vazia. */
export const OFFSET_MAXIMO = 10_000;

/** Maior `limit` que a busca honra por página. Valores acima são silenciosamente capados. */
export const LIMITE_POR_PAGINA = 200;

export type OrdemBusca =
  | 'downloadCount'
  | 'likeCount'
  | 'hotScore'
  | 'newUploads'
  | 'boosts'
  | 'collectionCount';

/** Modelo como vem na LISTAGEM. Não traz peso nem tempo — isso só no detalhe. */
export interface ModeloListagem {
  id: number;
  title: string;
  slug: string;
  cover: string;
  likeCount: number;
  collectionCount: number;
  printCount: number;
  downloadCount: number;
  commentCount: number;
  createTime: string;
  hotScore: number;
  nsfw: boolean;
  license: string;
  tags: string[];
  isExclusive: boolean;
  isAIGC: boolean;
  designCreator?: { name?: string; handle?: string };
}

/** Perfil de impressão de um modelo — a fonte de peso e tempo reais. */
export interface PerfilImpressao {
  title: string;
  /** Gramas de filamento previstas pelo fatiador do autor. */
  weight: number;
  /** Tempo de impressão previsto, em SEGUNDOS. */
  prediction: number;
  materialCnt: number;
  needAms: boolean;
  downloadCount: number;
  pictures?: Array<{ url: string; isRealLifePhoto: number }>;
  instanceFilaments?: Array<{ filamentType?: string }>;
}

export interface ModeloDetalhe {
  id: number;
  title: string;
  slug: string;
  summary: string;
  license: string;
  licenseDescriptionInfo?: { title?: string; content?: string };
  nsfw: boolean;
  isAIGC: boolean;
  allowReCreation: boolean;
  categories: Array<{ id: number; name: string }>;
  instances: PerfilImpressao[];
  designExtension?: { design_pictures?: Array<{ url: string }> };
  designCreator?: { name?: string; handle?: string };
}

/**
 * GET com retry e backoff. Rate-limit vive no chamador (ver `aguardar`), não aqui —
 * o retry é só pra blip de rede e 5xx/429 transitórios.
 */
async function buscarJson<T>(url: string, tentativas = 4): Promise<T> {
  let ultimoErro: unknown;

  for (let i = 0; i < tentativas; i++) {
    try {
      const resposta = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      });

      if (resposta.status === 429 || resposta.status >= 500) {
        throw new Error(`HTTP ${resposta.status} em ${url}`);
      }
      if (!resposta.ok) {
        throw new Error(`HTTP ${resposta.status} em ${url} (não recuperável)`);
      }
      return (await resposta.json()) as T;
    } catch (erro) {
      ultimoErro = erro;
      if (i < tentativas - 1) await aguardar(1500 * 2 ** i);
    }
  }
  throw ultimoErro;
}

export function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Uma página de modelos de uma categoria.
 *
 * @example
 * const { hits } = await listarModelos({ categoria: 800, ordem: 'downloadCount', offset: 0 });
 */
export async function listarModelos(params: {
  categoria: number;
  ordem: OrdemBusca;
  offset: number;
  limite?: number;
}): Promise<{ total: number; hits: ModeloListagem[] }> {
  const limite = Math.min(params.limite ?? LIMITE_POR_PAGINA, LIMITE_POR_PAGINA);
  const query = new URLSearchParams({
    categories: String(params.categoria),
    orderBy: params.ordem,
    limit: String(limite),
    offset: String(params.offset),
  });

  const url = `${BASE}/api/v1/search-service/select/design?${query}`;
  const json = await buscarJson<{ total?: number; hits?: ModeloListagem[] }>(url);
  return { total: json.total ?? 0, hits: json.hits ?? [] };
}

/** Detalhe completo de um modelo — peso, tempo, imagens, licença longa. */
export async function detalharModelo(id: number): Promise<ModeloDetalhe> {
  return buscarJson<ModeloDetalhe>(`${BASE}/api/v1/design-service/design/${id}`);
}

export function urlDoModelo(id: number, slug: string): string {
  return `${BASE}/en/models/${id}-${slug}`;
}
