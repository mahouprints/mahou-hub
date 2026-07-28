// Etapa 1 — varredura das subcategorias comerciais do MakerWorld.
//
// Ordem das ondas importa: `downloadCount` primeiro traz os campeões consolidados
// (é o que o Gabriel quer ver antes de qualquer coisa); as ordens seguintes cobrem
// ângulos que a primeira não alcança. Cada `orderBy` é uma janela diferente sobre a
// mesma categoria — sem isso o teto de 10.000 por consulta esconderia o resto do acervo.

import {
  aguardar,
  LIMITE_POR_PAGINA,
  listarModelos,
  OFFSET_MAXIMO,
  urlDoModelo,
  type ModeloListagem,
  type OrdemBusca,
} from './client.js';
import { analisarLicenca } from './licenca.js';
import { categoriasParaVarrer, nichosDaCategoria } from './nichos.js';
import {
  anexar,
  ARQUIVOS,
  garantirPastas,
  lerProgresso,
  salvarProgresso,
} from './armazenamento.js';
import type { ModeloColetado } from './tipos.js';

/** Pausa entre requisições. ~3 req/s é educado e não dispara o rate-limit da Cloudflare. */
const PAUSA_MS = 350;

export const ONDAS: Array<{ ordem: OrdemBusca; paginas: number; rotulo: string }> = [
  { ordem: 'downloadCount', paginas: 10, rotulo: 'mais baixados' },
  { ordem: 'collectionCount', paginas: 8, rotulo: 'mais salvos' },
  { ordem: 'likeCount', paginas: 8, rotulo: 'mais curtidos' },
  { ordem: 'hotScore', paginas: 6, rotulo: 'em alta' },
  { ordem: 'newUploads', paginas: 6, rotulo: 'recentes' },
];

function normalizar(bruto: ModeloListagem, categoria: number): ModeloColetado {
  const licenca = analisarLicenca(bruto.license);
  return {
    id: bruto.id,
    titulo: bruto.title,
    slug: bruto.slug,
    url: urlDoModelo(bruto.id, bruto.slug),
    capa: bruto.cover,
    downloads: bruto.downloadCount ?? 0,
    likes: bruto.likeCount ?? 0,
    colecoes: bruto.collectionCount ?? 0,
    impressoes: bruto.printCount ?? 0,
    comentarios: bruto.commentCount ?? 0,
    criadoEm: bruto.createTime,
    autor: bruto.designCreator?.name ?? '',
    tags: bruto.tags ?? [],
    licenca: bruto.license ?? '',
    licencaVeredicto: licenca.veredicto,
    licencaObrigacao: licenca.obrigacao,
    categorias: [categoria],
    nichosCandidatos: nichosDaCategoria(categoria).map((n) => n.chave),
  };
}

export interface ResumoColeta {
  paginasLidas: number;
  brutos: number;
  novos: number;
  vendaveis: number;
  descartadosPorLicenca: number;
}

/**
 * Varre todas as subcategorias comerciais e grava só o que a licença permite vender.
 *
 * O descarte por licença acontece AQUI, antes de gravar: guardar 120 mil modelos
 * invendáveis só pra jogar fora depois desperdiça disco e torna toda etapa seguinte
 * mais lenta. O contador de descartados fica no resumo pra auditoria.
 *
 * @example
 * await coletar({ ondas: ONDAS.slice(0, 1) }) // só os mais baixados
 */
export async function coletar(opcoes?: {
  ondas?: typeof ONDAS;
  categorias?: number[];
}): Promise<ResumoColeta> {
  await garantirPastas();

  const ondas = opcoes?.ondas ?? ONDAS;
  const categorias = opcoes?.categorias ?? categoriasParaVarrer();
  const progresso = await lerProgresso();
  const vistos = new Set(progresso.idsVistos);

  const resumo: ResumoColeta = {
    paginasLidas: 0,
    brutos: 0,
    novos: 0,
    vendaveis: 0,
    descartadosPorLicenca: 0,
  };

  for (const categoria of categorias) {
    for (const onda of ondas) {
      const chaveProgresso = `${categoria}:${onda.ordem}`;
      const jaFeito = progresso.paginas[chaveProgresso] ?? 0;

      for (let pagina = jaFeito; pagina < onda.paginas; pagina++) {
        const offset = pagina * LIMITE_POR_PAGINA;
        if (offset >= OFFSET_MAXIMO) break;

        const { hits } = await listarModelos({ categoria, ordem: onda.ordem, offset });
        resumo.paginasLidas++;
        resumo.brutos += hits.length;

        if (hits.length === 0) {
          progresso.paginas[chaveProgresso] = onda.paginas;
          break;
        }

        const paraGravar: ModeloColetado[] = [];
        for (const hit of hits) {
          if (vistos.has(hit.id)) continue;
          vistos.add(hit.id);
          resumo.novos++;

          if (hit.nsfw) continue;
          if (!analisarLicenca(hit.license).vendavel) {
            resumo.descartadosPorLicenca++;
            continue;
          }
          paraGravar.push(normalizar(hit, categoria));
        }

        await anexar(ARQUIVOS.coletados, paraGravar);
        resumo.vendaveis += paraGravar.length;

        progresso.paginas[chaveProgresso] = pagina + 1;
        progresso.idsVistos = [...vistos];
        await salvarProgresso(progresso);

        process.stdout.write(
          `\r[coleta] cat ${categoria} · ${onda.rotulo} · pág ${pagina + 1}/${onda.paginas} · ` +
            `${resumo.vendaveis} vendáveis de ${resumo.novos} únicos     `,
        );
        await aguardar(PAUSA_MS);
      }
    }
  }

  process.stdout.write('\n');
  return resumo;
}
