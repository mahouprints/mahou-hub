import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { caminho, garantirPastas } from './armazenamento.js';
import { aguardar, detalharModelo, listarModelos, urlDoModelo } from './client.js';
import type { ModeloDetalhe, ModeloListagem } from './client.js';
import { analisarLicenca } from './licenca.js';
import { carregarEnv } from './subir-hub.js';
import {
  LIMITES_FLEXI,
  paraPayloadFlexi,
  pareceFlexi,
  selecionarFlexi,
  type CandidatoFlexi,
  type LimitesFlexi,
  type PayloadFlexi,
} from './flexi-selecao.js';

const CATEGORIAS_FLEXI = [801, 805, 601, 603];
const RELATORIO = 'flexi-relatorio.json';
const PAYLOAD = 'flexi-payload.json';

interface OpcoesFlexi {
  ids: number[];
  amostras: string | null;
  paginas: number;
  limite: number;
  limites: LimitesFlexi;
}

interface RejeitadoFlexi {
  id: number;
  titulo: string;
  url: string;
  motivos: string[];
}

interface RelatorioFlexi {
  geradoEm: string;
  concluida: boolean;
  opcoes: OpcoesFlexi;
  candidatos: CandidatoFlexi[];
  pendentes: CandidatoFlexi[];
  rejeitados: RejeitadoFlexi[];
  erro?: string;
}

function argumentoPositivo(valor: string | undefined, nome: string): number {
  const numero = Number(valor);
  if (!valor || !Number.isFinite(numero) || numero <= 0) {
    throw new Error(`${nome}: recebido "${valor}"; informe um número maior que zero.`);
  }
  return numero;
}

/** Valida os limites antes da rede. Ex.: lerOpcoesFlexi(['--max-horas', '1.5']). */
export function lerOpcoesFlexi(argumentos: string[]): OpcoesFlexi {
  const opcoes: OpcoesFlexi = {
    ids: [],
    amostras: null,
    paginas: 3,
    limite: 80,
    limites: { ...LIMITES_FLEXI },
  };
  for (let indice = 0; indice < argumentos.length; indice += 2) {
    const nome = argumentos[indice]!;
    const valor = argumentos[indice + 1];
    if (nome === '--amostras') {
      if (!valor || valor.startsWith('--'))
        throw new Error('--amostras requer um diretório de JSONs.');
      opcoes.amostras = resolve(valor);
      continue;
    }
    if (nome === '--ids') {
      opcoes.ids = interpretarIds(valor);
      continue;
    }
    const numero = argumentoPositivo(valor, nome);
    if (nome === '--max-horas') opcoes.limites.horas = numero;
    else if (nome === '--max-gramas' && numero <= 60) opcoes.limites.gramas = numero;
    else if (nome === '--paginas' && Number.isInteger(numero) && numero <= 50)
      opcoes.paginas = numero;
    else if (nome === '--limite' && Number.isInteger(numero) && numero <= 200)
      opcoes.limite = numero;
    else
      throw new Error(
        `Opção inválida: ${nome} ${valor}. Gramas <=60, páginas 1..50, limite 1..200.`,
      );
  }
  return opcoes;
}

function interpretarIds(valor: string | undefined): number[] {
  if (!valor || !/^\d+(,\d+)*$/.test(valor))
    throw new Error('--ids requer IDs positivos separados por vírgula.');
  const ids = [...new Set(valor.split(',').map(Number))];
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
    throw new Error('--ids contém ID inválido.');
  return ids;
}

function rejeitarModelo(
  relatorio: RelatorioFlexi,
  modelo: ModeloListagem,
  motivos: string[],
): void {
  relatorio.rejeitados.push({
    id: modelo.id,
    titulo: modelo.title,
    url: urlDoModelo(modelo.id, modelo.slug),
    motivos,
  });
}

async function descobrirFlexi(
  opcoes: OpcoesFlexi,
  relatorio: RelatorioFlexi,
): Promise<ModeloListagem[]> {
  const modelos = new Map<number, ModeloListagem>();
  for (const categoria of CATEGORIAS_FLEXI) {
    for (let pagina = 0; pagina < opcoes.paginas; pagina++) {
      const { hits } = await listarModelos({
        categoria,
        ordem: 'downloadCount',
        offset: pagina * 200,
      });
      hits.forEach((modelo) => modelos.set(modelo.id, modelo));
      await aguardar(1000);
      if (hits.length < 200) break;
    }
  }
  const flexis = [...modelos.values()].filter((m) => pareceFlexi(m.title, m.tags));
  const vendaveis = flexis.filter((modelo) => {
    if (analisarLicenca(modelo.license).vendavel) return true;
    rejeitarModelo(relatorio, modelo, ['LICENCA_NAO_COMERCIAL_OU_DESCONHECIDA']);
    return false;
  });
  return vendaveis.sort((a, b) => b.downloadCount - a.downloadCount).slice(0, opcoes.limite);
}

function modeloDoDetalhe(detalhe: ModeloDetalhe): ModeloListagem {
  const bruto = detalhe as ModeloDetalhe & Partial<ModeloListagem> & { coverUrl?: string };
  return {
    id: detalhe.id,
    title: detalhe.title,
    slug: detalhe.slug,
    cover: bruto.coverUrl ?? '',
    likeCount: bruto.likeCount ?? 0,
    collectionCount: bruto.collectionCount ?? 0,
    printCount: bruto.printCount ?? 0,
    downloadCount: bruto.downloadCount ?? 0,
    commentCount: bruto.commentCount ?? 0,
    createTime: bruto.createTime ?? '',
    hotScore: bruto.hotScore ?? 0,
    nsfw: detalhe.nsfw,
    license: detalhe.license,
    tags: bruto.tags ?? [],
    isExclusive: bruto.isExclusive ?? false,
    isAIGC: detalhe.isAIGC,
    designCreator: detalhe.designCreator,
  };
}

function registrarDetalhe(
  relatorio: RelatorioFlexi,
  detalhe: ModeloDetalhe,
  modelo?: ModeloListagem,
  arquivo?: { caminho: string; modificadoEm: string },
): void {
  const origem = modelo ?? modeloDoDetalhe(detalhe);
  const resultado = selecionarFlexi(origem, detalhe, relatorio.opcoes.limites);
  if ('motivos' in resultado) return rejeitarModelo(relatorio, origem, resultado.motivos);
  if (arquivo) {
    resultado.candidato.coletadoEm = null;
    resultado.candidato.arquivoOrigem = arquivo.caminho;
    resultado.candidato.arquivoModificadoEm = arquivo.modificadoEm;
  }
  const destino = resultado.candidato.pendencias.length
    ? relatorio.pendentes
    : relatorio.candidatos;
  destino.push(resultado.candidato);
}

async function coletarDetalhes(relatorio: RelatorioFlexi): Promise<void> {
  const { opcoes } = relatorio;
  const modelos = opcoes.ids.length ? [] : await descobrirFlexi(opcoes, relatorio);
  const ids = opcoes.ids.length ? opcoes.ids.slice(0, opcoes.limite) : modelos.map((m) => m.id);
  for (const id of ids) {
    const detalhe = await detalharModelo(id);
    registrarDetalhe(
      relatorio,
      detalhe,
      modelos.find((m) => m.id === id) ?? { ...modeloDoDetalhe(detalhe), id },
    );
    console.log(
      `[flexi] ${id}: ${relatorio.candidatos.length} candidatos, ${relatorio.pendentes.length} pendentes.`,
    );
    await aguardar(1000);
  }
}

async function coletarAmostras(relatorio: RelatorioFlexi): Promise<void> {
  const { opcoes } = relatorio;
  const diretorio = opcoes.amostras!;
  const encontrados = (await readdir(diretorio)).filter((nome) => /^\d+\.json$/.test(nome));
  const ids = opcoes.ids.length
    ? opcoes.ids
    : encontrados.map((nome) => Number(nome.replace('.json', '')));
  for (const id of ids.slice(0, opcoes.limite)) {
    const arquivo = resolve(diretorio, `${id}.json`);
    const detalhe = JSON.parse(await readFile(arquivo, 'utf8')) as ModeloDetalhe;
    const modificadoEm = (await stat(arquivo)).mtime.toISOString();
    registrarDetalhe(
      relatorio,
      detalhe,
      { ...modeloDoDetalhe(detalhe), id },
      { caminho: arquivo, modificadoEm },
    );
  }
}

async function gravarRelatorio(relatorio: RelatorioFlexi): Promise<void> {
  relatorio.candidatos.sort((a, b) => b.scoreObjetivo - a.scoreObjetivo);
  relatorio.pendentes.sort((a, b) => b.scoreObjetivo - a.scoreObjetivo);
  const modelos = relatorio.concluida ? relatorio.candidatos.map(paraPayloadFlexi) : [];
  await writeFile(caminho(RELATORIO), JSON.stringify(relatorio, null, 2) + '\n', 'utf8');
  await writeFile(caminho(PAYLOAD), JSON.stringify({ modelos }, null, 2) + '\n', 'utf8');
}

/** Coleta flexi para revisão; nunca escreve no Hub. Ex.: executarFlexi(['--ids', '892737']). */
export async function executarFlexi(argumentos: string[]): Promise<void> {
  const opcoes = lerOpcoesFlexi(argumentos);
  await garantirPastas();
  const relatorio: RelatorioFlexi = {
    geradoEm: new Date().toISOString(),
    concluida: false,
    opcoes,
    candidatos: [],
    pendentes: [],
    rejeitados: [],
  };
  try {
    if (opcoes.amostras) await coletarAmostras(relatorio);
    else await coletarDetalhes(relatorio);
    relatorio.concluida = true;
  } catch (erro) {
    relatorio.erro = erro instanceof Error ? erro.message : String(erro);
    throw erro;
  } finally {
    await gravarRelatorio(relatorio);
  }
  console.log(
    `Relatório: ${caminho(RELATORIO)}\nImportação: ${caminho(PAYLOAD)}\n` +
      `${relatorio.candidatos.length} candidatos, ${relatorio.pendentes.length} pendentes de purga, ` +
      `${relatorio.rejeitados.length} rejeitados. Sem avaliação visual.`,
  );
}

/** Envia o lote apenas com confirmação explícita. Ex.: enviarPayloadFlexi(modelos, { confirmar: false }). */
export async function enviarPayloadFlexi(
  modelos: PayloadFlexi[],
  opcoes: {
    confirmar: boolean;
    base?: string;
    token?: string;
  },
): Promise<{ criados: number; atualizados: number }> {
  const base = (opcoes.base ?? 'https://api.mahouprints.com/api/v1').replace(/\/$/, '');
  if (!opcoes.confirmar) {
    console.log(
      `[simulação] ${modelos.length} modelos para ${base}/makerworld/bulk-import. Use --confirmar para enviar.`,
    );
    return { criados: 0, atualizados: 0 };
  }
  if (!opcoes.token)
    throw new Error('MAHOU_API_TOKEN ausente — configure .env.local ou importe o JSON pelo Hub.');
  const totais = { criados: 0, atualizados: 0 };
  for (let indice = 0; indice < modelos.length; indice += 100) {
    const resposta = await fetch(`${base}/makerworld/bulk-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opcoes.token}` },
      body: JSON.stringify({ modelos: modelos.slice(indice, indice + 100) }),
    });
    if (!resposta.ok)
      throw new Error(`Importação flexi: HTTP ${resposta.status} no lote ${indice / 100 + 1}.`);
    const resultado = (await resposta.json()) as { criados: number; atualizados: number };
    totais.criados += resultado.criados;
    totais.atualizados += resultado.atualizados;
  }
  return totais;
}

/** Reconstitui o payload do relatório concluído. Ex.: subirFlexi(['--confirmar']). */
export async function subirFlexi(argumentos: string[]): Promise<void> {
  if (argumentos.some((arg) => arg !== '--confirmar'))
    throw new Error('flexi-subir aceita somente --confirmar.');
  const relatorio = JSON.parse(await readFile(caminho(RELATORIO), 'utf8')) as RelatorioFlexi;
  if (!relatorio.concluida)
    throw new Error('Coleta incompleta: rode flexi novamente antes de importar.');
  const payload = relatorio.candidatos.map(paraPayloadFlexi);
  const env = await carregarEnv();
  const resultado = await enviarPayloadFlexi(payload, {
    confirmar: argumentos.includes('--confirmar'),
    base: env.MAHOU_API_BASE,
    token: env.MAHOU_API_TOKEN,
  });
  console.log(`${resultado.criados} criados · ${resultado.atualizados} atualizados.`);
}
