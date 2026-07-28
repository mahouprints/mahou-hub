// Etapa 6 — junta os vereditos da IA aos candidatos.
//
// Os avaliadores gravam um JSON por lote em `dados/resultados/`. Esta etapa costura tudo
// de volta nos candidatos e separa o que sobe pro Hub. Veredito ausente = modelo continua
// pendente, nunca vira aprovado por omissão.

import { mkdir, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ARQUIVOS, escrever, ler, PASTA_DADOS } from './armazenamento.js';
import type { AvaliacaoIa, ModeloAvaliado, ModeloCandidato, VeredictoIa } from './tipos.js';

export const PASTA_RESULTADOS = resolve(PASTA_DADOS, 'resultados');

/** Aceita array puro ou objeto com `avaliacoes` — avaliadores variam no envelope. */
function extrairAvaliacoes(bruto: string): AvaliacaoIa[] {
  const limpo = bruto
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  const json = JSON.parse(limpo) as unknown;

  if (Array.isArray(json)) return json as AvaliacaoIa[];
  if (json && typeof json === 'object' && Array.isArray((json as never)['avaliacoes'])) {
    return (json as { avaliacoes: AvaliacaoIa[] }).avaliacoes;
  }
  return [];
}

async function lerResultados(subpasta: string): Promise<Map<number, AvaliacaoIa>> {
  const pasta = resolve(PASTA_RESULTADOS, subpasta);
  await mkdir(pasta, { recursive: true });

  const porId = new Map<number, AvaliacaoIa>();
  for (const nome of await readdir(pasta)) {
    if (!nome.endsWith('.json')) continue;
    try {
      const bruto = await readFile(resolve(pasta, nome), 'utf-8');
      for (const avaliacao of extrairAvaliacoes(bruto)) {
        if (typeof avaliacao?.id === 'number') porId.set(avaliacao.id, avaliacao);
      }
    } catch (erro) {
      console.warn(`  aviso: ${nome} ilegível — ${erro instanceof Error ? erro.message : erro}`);
    }
  }
  return porId;
}

export interface ResumoConsolidacao {
  consolidados: number;
  aprovados: number;
  talvez: number;
  reprovados: number;
  semVeredito: number;
  /** IDs avaliados que não existem no catálogo — avaliador alucinou o item. */
  idsFantasma: number[];
}

/**
 * Lê `dados/resultados/triagem/` e `dados/resultados/curadoria/`, aplica sobre os
 * candidatos e grava `triagem.jsonl` e `aprovados.jsonl`.
 *
 * A curadoria manda quando existe: é a passada do Opus sobre o que o Haiku aprovou.
 */
export async function consolidar(): Promise<ResumoConsolidacao> {
  const candidatos = await ler<ModeloCandidato>(ARQUIVOS.candidatos);
  const triagem = await lerResultados('triagem');
  const curadoria = await lerResultados('curadoria');

  const resumo: ResumoConsolidacao = {
    consolidados: 0,
    aprovados: 0,
    talvez: 0,
    reprovados: 0,
    semVeredito: 0,
    idsFantasma: [],
  };

  // Avaliador que inventa item devolve id que não existe no catálogo (placeholders como
  // 1111111 já apareceram). O join abaixo descartaria isso em silêncio — e silêncio aqui
  // esconde que um modelo REAL ficou sem avaliação no lugar do inventado.
  const idsReais = new Set(candidatos.map((c) => c.id));
  for (const id of [...triagem.keys(), ...curadoria.keys()]) {
    if (!idsReais.has(id)) resumo.idsFantasma.push(id);
  }

  const avaliados: ModeloAvaliado[] = [];

  for (const candidato of candidatos) {
    const daTriagem = triagem.get(candidato.id);
    if (!daTriagem) {
      resumo.semVeredito++;
      continue;
    }

    const daCuradoria = curadoria.get(candidato.id);
    avaliados.push({
      ...candidato,
      triagem: { ...daTriagem, avaliadoPor: 'HAIKU' },
      curadoria: daCuradoria ? { ...daCuradoria, avaliadoPor: 'OPUS' } : undefined,
    });
    resumo.consolidados++;
  }

  const vereditoFinal = (m: ModeloAvaliado): VeredictoIa =>
    m.curadoria?.veredicto ?? m.triagem.veredicto;
  const notaFinal = (m: ModeloAvaliado): number => m.curadoria?.nota ?? m.triagem.nota;

  for (const m of avaliados) {
    const v = vereditoFinal(m);
    if (v === 'APROVADO') resumo.aprovados++;
    else if (v === 'TALVEZ') resumo.talvez++;
    else resumo.reprovados++;
  }

  avaliados.sort((a, b) => notaFinal(b) - notaFinal(a));
  await escrever(ARQUIVOS.triagem, avaliados);
  await escrever(
    ARQUIVOS.aprovados,
    avaliados.filter((m) => vereditoFinal(m) !== 'REPROVADO'),
  );

  return resumo;
}
