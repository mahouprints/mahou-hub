// Etapa 4 — baixa e reduz as imagens dos candidatos para avaliação visual.
//
// Reduzir para 768px no maior lado não é economia à toa: é o suficiente pra julgar apelo
// comercial (formato, acabamento, se parece produto ou protótipo) e corta o custo de
// tokens de imagem para cerca de um terço do que a original custaria. Duas imagens por
// modelo — a primeira já vem sendo a foto real quando o autor publicou uma.

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { aguardar } from './client.js';
import { ARQUIVOS, escrever, garantirPastas, ler, PASTA_IMAGENS } from './armazenamento.js';
import type { ModeloCandidato } from './tipos.js';

const LADO_MAXIMO = 768;
const IMAGENS_POR_MODELO = 2;
const PAUSA_MS = 120;

async function baixarEReduzir(url: string, destino: string): Promise<boolean> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return false;

    const original = Buffer.from(await resposta.arrayBuffer());
    const reduzida = await sharp(original)
      .resize(LADO_MAXIMO, LADO_MAXIMO, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();

    await writeFile(destino, reduzida);
    return true;
  } catch {
    return false;
  }
}

/**
 * Preenche `imagensLocais` em cada candidato e regrava o arquivo.
 * Modelo cujas imagens todas falharem sai da lista — sem imagem não há o que avaliar.
 */
export async function baixarImagens(opcoes?: { limite?: number }): Promise<{
  processados: number;
  arquivos: number;
  semImagem: number;
}> {
  await garantirPastas();
  const candidatos = await ler<ModeloCandidato>(ARQUIVOS.candidatos);
  const alvo = candidatos.slice(0, opcoes?.limite ?? candidatos.length);

  let arquivos = 0;
  let semImagem = 0;
  const comImagem: ModeloCandidato[] = [];

  for (const [indice, modelo] of alvo.entries()) {
    if (modelo.imagensLocais && modelo.imagensLocais.length > 0) {
      comImagem.push(modelo);
      continue;
    }

    const locais: string[] = [];
    for (const [i, url] of modelo.imagens.slice(0, IMAGENS_POR_MODELO).entries()) {
      const destino = resolve(PASTA_IMAGENS, `${modelo.id}-${i}.jpg`);
      if (await baixarEReduzir(url, destino)) {
        locais.push(destino);
        arquivos++;
      }
      await aguardar(PAUSA_MS);
    }

    if (locais.length === 0) {
      semImagem++;
      continue;
    }
    comImagem.push({ ...modelo, imagensLocais: locais });
    process.stdout.write(`\r[imagens] ${indice + 1}/${alvo.length} · ${arquivos} arquivos   `);
  }

  // Preserva a cauda não processada quando rodou com `limite`.
  const restantes = candidatos.slice(alvo.length);
  await escrever(ARQUIVOS.candidatos, [...comImagem, ...restantes]);

  process.stdout.write('\n');
  return { processados: alvo.length, arquivos, semImagem };
}
