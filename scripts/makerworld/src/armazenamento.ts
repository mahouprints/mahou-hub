// Persistência em JSONL na pasta `dados/`. Uma linha = um modelo.
//
// POR QUE JSONL E NÃO BANCO: cada etapa do pipeline é reexecutável de forma
// independente, e coletar ~120 mil modelos leva horas. Arquivo em disco deixa
// inspecionar com `wc -l` / `jq` no meio da execução e retomar de onde parou
// sem subir infra. O banco só entra no fim, quando os candidatos sobem pro Hub.

import { createReadStream } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
export const PASTA_DADOS = resolve(aqui, '../dados');
export const PASTA_IMAGENS = resolve(aqui, '../dados/imagens');
export const PASTA_LOTES = resolve(aqui, '../dados/lotes');

export const ARQUIVOS = {
  coletados: 'coletados.jsonl',
  enriquecidos: 'enriquecidos.jsonl',
  candidatos: 'candidatos.jsonl',
  triagem: 'triagem.jsonl',
  curadoria: 'curadoria.jsonl',
  aprovados: 'aprovados.jsonl',
  /** Marca onde a varredura parou, pra retomar sem repetir páginas. */
  progresso: 'progresso.json',
} as const;

export async function garantirPastas(): Promise<void> {
  await mkdir(PASTA_DADOS, { recursive: true });
  await mkdir(PASTA_IMAGENS, { recursive: true });
  await mkdir(PASTA_LOTES, { recursive: true });
}

export function caminho(arquivo: string): string {
  return resolve(PASTA_DADOS, arquivo);
}

/** Acrescenta registros ao fim do arquivo. Nunca reescreve — append-only por etapa. */
export async function anexar<T>(arquivo: string, registros: T[]): Promise<void> {
  if (registros.length === 0) return;
  const linhas = registros.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await appendFile(caminho(arquivo), linhas, 'utf-8');
}

export async function escrever<T>(arquivo: string, registros: T[]): Promise<void> {
  const linhas = registros.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await writeFile(caminho(arquivo), linhas, 'utf-8');
}

/**
 * Lê o arquivo inteiro na memória. Seguro até algumas centenas de milhares de
 * linhas; acima disso use `percorrer`.
 */
export async function ler<T>(arquivo: string): Promise<T[]> {
  let bruto: string;
  try {
    bruto = await readFile(caminho(arquivo), 'utf-8');
  } catch {
    return [];
  }
  return bruto
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

/** Streaming linha a linha — pra quando o arquivo não cabe confortavelmente na memória. */
export async function* percorrer<T>(arquivo: string): AsyncGenerator<T> {
  const leitor = createInterface({
    input: createReadStream(caminho(arquivo), 'utf-8'),
    crlfDelay: Infinity,
  });
  for await (const linha of leitor) {
    if (linha.trim().length > 0) yield JSON.parse(linha) as T;
  }
}

export interface Progresso {
  /** `${categoria}:${ordem}` → maior offset já concluído. */
  paginas: Record<string, number>;
  idsVistos: number[];
  atualizadoEm: string;
}

export async function lerProgresso(): Promise<Progresso> {
  try {
    const bruto = await readFile(caminho(ARQUIVOS.progresso), 'utf-8');
    return JSON.parse(bruto) as Progresso;
  } catch {
    return { paginas: {}, idsVistos: [], atualizadoEm: new Date().toISOString() };
  }
}

export async function salvarProgresso(p: Progresso): Promise<void> {
  p.atualizadoEm = new Date().toISOString();
  await writeFile(caminho(ARQUIVOS.progresso), JSON.stringify(p), 'utf-8');
}
