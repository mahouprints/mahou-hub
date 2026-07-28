// Etapa 2 — puxa o detalhe de cada sobrevivente da coleta.
//
// A listagem não traz peso nem tempo; sem eles não dá pra estimar margem, e margem é
// o que decide o que vale mandar pra avaliação visual. Uma requisição por modelo, então
// esta etapa só roda sobre o que já passou pelos filtros de licença e tração.

import { aguardar, detalharModelo, type ModeloDetalhe } from './client.js';
import { anexar, ARQUIVOS, ler } from './armazenamento.js';
import type { ModeloColetado, ModeloEnriquecido, PerfilNormalizado } from './tipos.js';

const PAUSA_MS = 300;

function normalizarPerfis(detalhe: ModeloDetalhe): PerfilNormalizado[] {
  return (detalhe.instances ?? [])
    .filter((i) => i.weight > 0 && i.prediction > 0)
    .map((i) => ({
      titulo: i.title,
      gramas: i.weight,
      horas: Number((i.prediction / 3600).toFixed(2)),
      cores: i.materialCnt ?? 1,
      precisaAms: Boolean(i.needAms),
      downloads: i.downloadCount ?? 0,
    }));
}

/**
 * Entre os perfis publicados, escolhe o mais barato de produzir na Mahou:
 * sem AMS na frente (troca de cor multiplica tempo e desperdício), depois menos gramas.
 * Um modelo com versão "AMS" de 231g e versão "sem AMS" de 84g é um modelo de 84g
 * pra efeito de custo — foi assim que o Hei Hei apareceu na amostragem.
 */
function escolherPerfil(perfis: PerfilNormalizado[]): PerfilNormalizado | null {
  if (perfis.length === 0) return null;
  const ordenados = [...perfis].sort((a, b) => {
    if (a.precisaAms !== b.precisaAms) return a.precisaAms ? 1 : -1;
    return a.gramas - b.gramas;
  });
  return ordenados[0] ?? null;
}

/** Fotos reais na frente: julgar apelo comercial por render infla a nota. */
function ordenarImagens(detalhe: ModeloDetalhe): { imagens: string[]; temFotoReal: boolean } {
  const dosPerfis = (detalhe.instances ?? []).flatMap((i) => i.pictures ?? []);
  const reais = dosPerfis.filter((p) => p.isRealLifePhoto === 1).map((p) => p.url);
  const renders = dosPerfis.filter((p) => p.isRealLifePhoto !== 1).map((p) => p.url);
  const doDesign = (detalhe.designExtension?.design_pictures ?? []).map((p) => p.url);

  const todas = [...new Set([...reais, ...doDesign, ...renders])].filter(Boolean);
  return { imagens: todas.slice(0, 4), temFotoReal: reais.length > 0 };
}

export async function enriquecer(opcoes?: {
  limite?: number;
  downloadsMinimos?: number;
}): Promise<{ processados: number; semPerfil: number; pulados: number }> {
  const coletados = await ler<ModeloColetado>(ARQUIVOS.coletados);
  const jaFeitos = new Set(
    (await ler<ModeloEnriquecido>(ARQUIVOS.enriquecidos)).map((m) => m.id),
  );

  // Pré-filtro de tração: `filtrar` cortaria esses depois de qualquer jeito, e cada
  // enriquecimento custa uma requisição. Vale gastar só com quem tem chance de passar.
  const minimo = opcoes?.downloadsMinimos ?? 0;
  const naoEnriquecidos = coletados.filter((m) => !jaFeitos.has(m.id));
  const comTracao = naoEnriquecidos.filter((m) => m.downloads >= minimo);
  const pulados = naoEnriquecidos.length - comTracao.length;

  const pendentes = comTracao.slice(0, opcoes?.limite ?? comTracao.length);

  let processados = 0;
  let semPerfil = 0;
  const buffer: ModeloEnriquecido[] = [];

  for (const modelo of pendentes) {
    try {
      const detalhe = await detalharModelo(modelo.id);
      const perfis = normalizarPerfis(detalhe);
      const { imagens, temFotoReal } = ordenarImagens(detalhe);
      if (perfis.length === 0) semPerfil++;

      buffer.push({
        ...modelo,
        resumo: (detalhe.summary ?? '').slice(0, 600),
        perfis,
        perfilEscolhido: escolherPerfil(perfis),
        imagens,
        temFotoReal,
        geradoPorIa: Boolean(detalhe.isAIGC),
        categorias: [
          ...new Set([...modelo.categorias, ...(detalhe.categories ?? []).map((c) => c.id)]),
        ],
      });
      processados++;
    } catch {
      // Modelo removido ou privado desde a coleta — segue o baile, não é erro fatal.
    }

    if (buffer.length >= 50) {
      await anexar(ARQUIVOS.enriquecidos, buffer.splice(0));
    }
    process.stdout.write(`\r[enriquecer] ${processados}/${pendentes.length}      `);
    await aguardar(PAUSA_MS);
  }

  await anexar(ARQUIVOS.enriquecidos, buffer);
  process.stdout.write('\n');
  return { processados, semPerfil, pulados };
}
