// Etapa 5 — empacota os candidatos em lotes para os avaliadores.
//
// Cada lote vira um arquivo .md autocontido: rubrica + metadados + caminhos das imagens.
// O subagente lê o arquivo, abre as imagens e devolve o JSON. Autocontido de propósito —
// assim o avaliador não precisa de contexto da conversa nem acesso ao resto do pipeline.

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ARQUIVOS, garantirPastas, ler, PASTA_LOTES } from './armazenamento.js';
import { FORMATO_SAIDA, RUBRICA } from './rubrica.js';
import type { ModeloCandidato } from './tipos.js';

/**
 * 12 modelos por lote. Acima disso a atenção visual do avaliador se dilui nas últimas
 * imagens do lote e as notas ficam ruidosas; abaixo, o custo fixo da rubrica domina.
 */
const MODELOS_POR_LOTE = 12;

function reais(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

function ficha(modelo: ModeloCandidato, posicao: number): string {
  const e = modelo.estimativa;
  const imagens = (modelo.imagensLocais ?? []).map((c) => `  - ${c}`).join('\n');

  const formato =
    e.unidadesPorKit > 1
      ? `KIT de ${e.unidadesPorKit} unidades (${e.gramasPorUnidade}g cada) — peça avulsa é pequena demais pra anúncio próprio`
      : 'peça avulsa';

  return `### ${posicao}. id ${modelo.id} — ${modelo.titulo}

- Autor: ${modelo.autor || '(sem nome)'}
- Downloads: ${modelo.downloads.toLocaleString('pt-BR')} · Salvos: ${modelo.colecoes.toLocaleString('pt-BR')} · Curtidas: ${modelo.likes.toLocaleString('pt-BR')}
- Formato do anúncio: ${formato}
- Impressão do anúncio: ${e.gramas}g em ${e.horas}h${modelo.perfilEscolhido?.precisaAms ? ' (precisa AMS)' : ''} · ${modelo.perfilEscolhido?.cores ?? 1} cor(es)
- Custo estimado: ${reais(e.custoTotalCentavos)} · Preço sugerido: ${reais(e.precoSugeridoCentavos)} · Margem: ${e.margemEstimadaPct}% · ${reais(e.lucroPorHoraCentavos)}/hora de impressora
- Licença: ${modelo.licenca}
- Tags: ${modelo.tags.slice(0, 10).join(', ') || '(sem tags)'}
- Imagens para avaliar (julgue você se é foto real ou render — o campo
  \`isRealLifePhoto\` do MakerWorld marca só 10% do acervo e erra pra menos com frequência,
  então não informamos aqui pra não enviesar):
${imagens}
`;
}

/**
 * Gera os lotes de triagem.
 *
 * `somenteSemAvaliacao` refaz só o que ficou órfão. Isso não é hipotético: avaliadores
 * inventam ids de vez em quando (placeholders como 1111111 já apareceram), e o modelo
 * real que deveria estar naquela linha fica sem veredicto. Sem uma via de reprocessar
 * só os buracos, a alternativa seria refazer os 128 lotes inteiros.
 */
export async function gerarLotes(opcoes?: {
  limite?: number;
  porLote?: number;
  somenteSemAvaliacao?: boolean;
}): Promise<{ lotes: number; modelos: number; caminhos: string[] }> {
  await garantirPastas();

  let candidatos = (await ler<ModeloCandidato>(ARQUIVOS.candidatos)).filter(
    (m) => (m.imagensLocais?.length ?? 0) > 0,
  );

  if (opcoes?.somenteSemAvaliacao) {
    const jaAvaliados = new Set(
      (await ler<{ id: number }>(ARQUIVOS.triagem)).map((m) => m.id),
    );
    candidatos = candidatos.filter((c) => !jaAvaliados.has(c.id));
  }

  const alvo = candidatos.slice(0, opcoes?.limite ?? candidatos.length);
  const porLote = opcoes?.porLote ?? MODELOS_POR_LOTE;
  const prefixo = opcoes?.somenteSemAvaliacao ? 'orfao' : 'lote';

  const caminhos: string[] = [];
  for (let i = 0; i < alvo.length; i += porLote) {
    const fatia = alvo.slice(i, i + porLote);
    const numero = String(Math.floor(i / porLote) + 1).padStart(3, '0');
    const arquivo = resolve(PASTA_LOTES, `${prefixo}-${numero}.md`);

    const conteudo = [
      `# Lote ${numero} — ${fatia.length} modelos para avaliar`,
      '',
      RUBRICA,
      '',
      '---',
      '',
      '## Modelos deste lote',
      '',
      'Abra cada imagem listada abaixo com a ferramenta Read antes de dar a nota.',
      '',
      ...fatia.map((m, indice) => ficha(m, indice + 1)),
      '---',
      '',
      '## Formato da resposta',
      '',
      FORMATO_SAIDA,
      '',
    ].join('\n');

    await writeFile(arquivo, conteudo, 'utf-8');
    caminhos.push(arquivo);
  }

  return { lotes: caminhos.length, modelos: alvo.length, caminhos };
}
