// Etapa 5b — lotes de segunda opinião para a zona cinzenta da triagem.
//
// POR QUE SÓ A ZONA CINZENTA: os erros que a curadoria pegou na primeira onda não foram
// de percepção visual — o triador viu a imagem certa e errou o julgamento de MERCADO
// (luminária sem soquete pontuada como produto pronto, porta-cartão SD com público que
// não existe no Brasil). Reprovar benchy e farejar personagem licenciado a triagem já
// acerta sozinha. Então a segunda passada só faz sentido onde a decisão é comercial:
// os TALVEZ e os aprovados de nota média. Aprovado 80+ vai direto pra curadoria humana.

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ARQUIVOS, garantirPastas, ler, PASTA_LOTES } from './armazenamento.js';
import { FORMATO_SAIDA, RUBRICA } from './rubrica.js';
import type { ModeloAvaliado } from './tipos.js';

const MODELOS_POR_LOTE = 10;

/** Limites da faixa que vai pra segunda opinião. Fora dela, a triagem basta. */
export const FAIXA_CINZENTA = { notaMinima: 60, notaMaxima: 79 };

const INSTRUCAO_EXTRA = `## Esta é uma SEGUNDA OPINIÃO

Cada modelo abaixo já passou por uma triagem rápida, e o veredicto dela está na ficha.
Sua tarefa não é repetir aquele julgamento — é revisá-lo com mais rigor comercial.

A triagem é confiável em reconhecer o que é peça técnica e em farejar marca licenciada.
Onde ela erra é no julgamento de mercado. Preste atenção especial a:

- **Custo escondido que a foto não mostra.** A peça precisa de ímã, parafuso, rolamento,
  soquete, fio, lâmpada, elástico ou adesivo pra funcionar como produto? Isso é insumo
  comprado, montagem e margem que somem — e frequentemente a foto do autor já mostra o
  produto montado com esses itens, dando a impressão de que vêm juntos.
- **Tamanho real do público no Brasil.** Peça bem executada para um hobby que quase
  ninguém tem aqui não vende. Pergunte quem digitaria isso na busca da Shopee.
- **Se a foto é render ou peça impressa de verdade.** Render esconde camada aparente,
  warping e sag. Modelo que só tem render é aposta, não certeza.
- **Nicho correto.** A triagem erra categoria com frequência; corrija pelo que você vê.

Confirme, suba ou desça a nota conforme seu próprio julgamento. Rebaixar um aprovado
para TALVEZ ou REPROVADO é resultado esperado e útil — não hesite.`;

function reais(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

function ficha(m: ModeloAvaliado, posicao: number): string {
  const e = m.estimativa;
  const formato =
    e.unidadesPorKit > 1
      ? `KIT de ${e.unidadesPorKit} unidades (${e.gramasPorUnidade}g cada)`
      : 'peça avulsa';
  const alertas = m.triagem.alertas?.length ? m.triagem.alertas.join(', ') : 'nenhum';

  return `### ${posicao}. id ${m.id} — ${m.titulo}

- **Veredicto da triagem: ${m.triagem.veredicto} · nota ${m.triagem.nota} · nicho ${m.triagem.nicho}**
- Justificativa da triagem: "${m.triagem.justificativa}"
- Alertas que a triagem marcou: ${alertas}
- Downloads: ${m.downloads.toLocaleString('pt-BR')} · Salvos: ${m.colecoes.toLocaleString('pt-BR')}
- Formato do anúncio: ${formato}
- Impressão do anúncio: ${e.gramas}g em ${e.horas}h · ${m.perfilEscolhido?.cores ?? 1} cor(es)
- Custo: ${reais(e.custoTotalCentavos)} · Preço sugerido: ${reais(e.precoSugeridoCentavos)} · ${reais(e.lucroPorHoraCentavos)}/hora
- Licença: ${m.licenca}
- Foto real do autor: ${m.temFotoReal ? 'sim' : 'não — só render'}
- Imagens para avaliar:
${(m.imagensLocais ?? []).map((c) => `  - ${c}`).join('\n')}
`;
}

/** Modelos que merecem uma segunda passada: TALVEZ, ou aprovado de nota média. */
export function estaNaFaixaCinzenta(m: ModeloAvaliado): boolean {
  if (m.curadoria) return false; // já passou por humano, não regride
  if (m.triagem.veredicto === 'TALVEZ') return true;
  return (
    m.triagem.veredicto === 'APROVADO' &&
    m.triagem.nota >= FAIXA_CINZENTA.notaMinima &&
    m.triagem.nota <= FAIXA_CINZENTA.notaMaxima
  );
}

export async function gerarLotesSegundaOpiniao(opcoes?: {
  limite?: number;
  porLote?: number;
}): Promise<{ lotes: number; modelos: number; caminhos: string[] }> {
  await garantirPastas();

  const avaliados = await ler<ModeloAvaliado>(ARQUIVOS.triagem);
  const alvo = avaliados
    .filter(estaNaFaixaCinzenta)
    .filter((m) => (m.imagensLocais?.length ?? 0) > 0)
    .slice(0, opcoes?.limite ?? undefined);

  const porLote = opcoes?.porLote ?? MODELOS_POR_LOTE;
  const caminhos: string[] = [];

  for (let i = 0; i < alvo.length; i += porLote) {
    const fatia = alvo.slice(i, i + porLote);
    const numero = String(Math.floor(i / porLote) + 1).padStart(3, '0');
    const arquivo = resolve(PASTA_LOTES, `revisao-${numero}.md`);

    const conteudo = [
      `# Revisão ${numero} — segunda opinião sobre ${fatia.length} modelos`,
      '',
      RUBRICA,
      '',
      '---',
      '',
      INSTRUCAO_EXTRA,
      '',
      '---',
      '',
      '## Modelos desta revisão',
      '',
      'Abra cada imagem listada com a ferramenta Read antes de decidir.',
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
