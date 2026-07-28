// Etapa 7 — envia os aprovados pro Mahou Hub.
//
// Escrita em produção exige OK explícito do Gabriel, então o padrão é `--dry-run`:
// sem a flag `--confirmar` o comando só mostra o que enviaria. A base é lida da env
// (`MAHOU_API_BASE`), com o token no mesmo `.env.local` que o MCP server já usa.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARQUIVOS, ler } from './armazenamento.js';
import type { ModeloAvaliado } from './tipos.js';

const aqui = dirname(fileURLToPath(import.meta.url));

async function carregarEnv(): Promise<Record<string, string>> {
  const candidatos = [
    resolve(aqui, '../.env.local'),
    resolve(aqui, '../../../mcp-servers/mahou-hub/.env.local'),
  ];

  const env: Record<string, string> = {};
  for (const caminho of candidatos) {
    let bruto: string;
    try {
      bruto = await readFile(caminho, 'utf-8');
    } catch {
      continue;
    }
    for (const linha of bruto.split(/\r?\n/)) {
      const limpa = linha.trim();
      if (!limpa || limpa.startsWith('#')) continue;
      const corte = limpa.indexOf('=');
      if (corte < 0) continue;
      const chave = limpa.slice(0, corte).trim();
      const valor = limpa.slice(corte + 1).trim().replace(/^["']|["']$/g, '');
      if (!(chave in env)) env[chave] = valor;
    }
  }
  return { ...env, ...process.env } as Record<string, string>;
}

/** Payload do `POST /makerworld/bulk-import`. Espelha `MakerworldBulkImportSchema`. */
function paraPayload(m: ModeloAvaliado) {
  const veredicto = m.curadoria?.veredicto ?? m.triagem.veredicto;
  const avaliacao = m.curadoria ?? m.triagem;

  return {
    externalId: String(m.id),
    titulo: m.titulo,
    url: m.url,
    autor: m.autor,
    imagemUrl: m.imagens[0] ?? m.capa,
    downloads: m.downloads,
    curtidas: m.likes,
    colecoes: m.colecoes,
    licenca: m.licenca,
    licencaVeredicto: m.licencaVeredicto,
    licencaObrigacao: m.licencaObrigacao,
    nicho: avaliacao.nicho,
    pesoGramas: m.estimativa.gramas,
    tempoHoras: m.estimativa.horas,
    custoEstimadoCentavos: m.estimativa.custoTotalCentavos,
    precoSugeridoCentavos: m.estimativa.precoSugeridoCentavos,
    margemEstimadaPct: m.estimativa.margemEstimadaPct,
    lucroPorHoraCentavos: m.estimativa.lucroPorHoraCentavos,
    scoreObjetivo: m.scoreObjetivo,
    notaIa: avaliacao.nota,
    veredictoIa: veredicto,
    justificativaIa: avaliacao.justificativa,
    alertas: avaliacao.alertas ?? [],
    tags: m.tags.slice(0, 15),
    temFotoReal: m.temFotoReal,
  };
}

export async function subirParaHub(opcoes?: { limite?: number }): Promise<{
  enviados: number;
  jaExistiam: number;
  falhas: number;
}> {
  const env = await carregarEnv();
  const base = env.MAHOU_API_BASE ?? 'https://api.mahouprints.com/api/v1';
  const token = env.MAHOU_API_TOKEN;
  const confirmar = process.argv.includes('--confirmar');

  const aprovados = (await ler<ModeloAvaliado>(ARQUIVOS.aprovados)).slice(
    0,
    opcoes?.limite ?? undefined,
  );
  const payload = aprovados.map(paraPayload);

  if (!confirmar) {
    console.log(
      `\n[simulação] ${payload.length} modelos iriam para ${base}/makerworld/bulk-import\n` +
        `Rode de novo com --confirmar para enviar de verdade.\n`,
    );
    for (const p of payload.slice(0, 10)) {
      console.log(`  ${String(p.notaIa).padStart(3)} · ${p.nicho.padEnd(20)} · ${p.titulo}`);
    }
    if (payload.length > 10) console.log(`  … e mais ${payload.length - 10}`);
    return { enviados: 0, jaExistiam: 0, falhas: 0 };
  }

  if (!token) throw new Error('MAHOU_API_TOKEN ausente — não dá pra escrever no Hub.');

  // Lotes de 100: o endpoint faz upsert em transação e um payload gigante estoura o
  // limite de body do Nest antes de chegar no Prisma.
  let enviados = 0;
  let jaExistiam = 0;
  let falhas = 0;

  for (let i = 0; i < payload.length; i += 100) {
    const lote = payload.slice(i, i + 100);
    const resposta = await fetch(`${base}/makerworld/bulk-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ modelos: lote }),
    });

    if (!resposta.ok) {
      falhas += lote.length;
      console.error(`  lote ${i / 100 + 1}: HTTP ${resposta.status} — ${await resposta.text()}`);
      continue;
    }
    const r = (await resposta.json()) as { criados?: number; atualizados?: number };
    enviados += r.criados ?? 0;
    jaExistiam += r.atualizados ?? 0;
  }

  return { enviados, jaExistiam, falhas };
}
