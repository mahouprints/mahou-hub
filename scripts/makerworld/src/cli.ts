// Orquestrador do pipeline. Cada etapa é um comando separado e retomável — a coleta
// leva horas, e forçar tudo num comando só significaria recomeçar do zero a cada ajuste.
//
//   npm run coletar      varre as subcategorias comerciais (só grava o que é vendável)
//   npm run enriquecer   busca peso, tempo e imagens dos coletados
//   npm run filtrar      corta inviáveis e pontua por regra
//   npm run imagens      baixa e reduz as imagens dos candidatos
//   npm run lotes        gera os arquivos de lote pros avaliadores
//   npm run consolidar   junta os vereditos da IA com os candidatos
//   npm run subir        envia os aprovados pro Mahou Hub
//   npm run status       mostra onde o pipeline está

import { ARQUIVOS, ler } from './armazenamento.js';
import { coletar, ONDAS } from './coletar.js';
import { enriquecer } from './enriquecer.js';
import { filtrar, LIMITES_PADRAO } from './filtrar.js';
import { baixarImagens } from './imagens.js';
import { gerarLotes } from './lotes.js';
import { consolidar } from './consolidar.js';
import { subirParaHub } from './subir-hub.js';
import type { ModeloAvaliado, ModeloCandidato, ModeloColetado } from './tipos.js';

function numeroDoArgumento(bandeira: string): number | undefined {
  const indice = process.argv.indexOf(bandeira);
  if (indice < 0) return undefined;
  const valor = Number(process.argv[indice + 1]);
  return Number.isFinite(valor) ? valor : undefined;
}

async function status(): Promise<void> {
  const coletados = await ler<ModeloColetado>(ARQUIVOS.coletados);
  const enriquecidos = await ler<ModeloColetado>(ARQUIVOS.enriquecidos);
  const candidatos = await ler<ModeloCandidato>(ARQUIVOS.candidatos);
  const triagem = await ler<ModeloAvaliado>(ARQUIVOS.triagem);
  const aprovados = await ler<ModeloAvaliado>(ARQUIVOS.aprovados);
  const comImagem = candidatos.filter((c) => (c.imagensLocais?.length ?? 0) > 0).length;

  console.log(`
  coletados (vendáveis)  ${coletados.length}
  enriquecidos           ${enriquecidos.length}
  candidatos viáveis     ${candidatos.length}   (${comImagem} com imagem baixada)
  triados pela IA        ${triagem.length}
  aprovados finais       ${aprovados.length}
`);
}

async function principal(): Promise<void> {
  const comando = process.argv[2];
  const limite = numeroDoArgumento('--limite');

  switch (comando) {
    case 'coletar': {
      // `--rapido` roda só a onda de mais baixados: bom pra validar o pipeline
      // inteiro em minutos antes de largar a varredura completa.
      const ondas = process.argv.includes('--rapido') ? ONDAS.slice(0, 1) : ONDAS;
      const r = await coletar({ ondas });
      console.log(
        `\n${r.vendaveis} vendáveis de ${r.novos} únicos em ${r.paginasLidas} páginas.\n` +
          `${r.descartadosPorLicenca} descartados por licença ` +
          `(${((r.descartadosPorLicenca / Math.max(r.novos, 1)) * 100).toFixed(1)}% do acervo).`,
      );
      break;
    }
    case 'enriquecer': {
      const r = await enriquecer({
        limite,
        downloadsMinimos: numeroDoArgumento('--downloads-min') ?? LIMITES_PADRAO.downloadsMinimos,
      });
      console.log(
        `\n${r.processados} enriquecidos · ${r.semPerfil} sem perfil de impressão · ` +
          `${r.pulados} pulados por tração baixa.`,
      );
      break;
    }
    case 'filtrar': {
      const r = await filtrar(LIMITES_PADRAO);
      console.log(`\n${r.aprovados} candidatos de ${r.entraram} enriquecidos.\nCortes:`);
      for (const [motivo, qtd] of Object.entries(r.cortes)) {
        if (qtd > 0) console.log(`  ${motivo.padEnd(22)} ${qtd}`);
      }
      break;
    }
    case 'imagens': {
      const r = await baixarImagens({ limite });
      console.log(`\n${r.arquivos} imagens de ${r.processados} modelos · ${r.semImagem} sem imagem.`);
      break;
    }
    case 'lotes': {
      const r = await gerarLotes({ limite, porLote: numeroDoArgumento('--por-lote') });
      console.log(`\n${r.lotes} lotes com ${r.modelos} modelos em dados/lotes/.`);
      break;
    }
    case 'consolidar': {
      const r = await consolidar();
      console.log(
        `\n${r.consolidados} vereditos aplicados · ${r.aprovados} aprovados · ` +
          `${r.talvez} talvez · ${r.reprovados} reprovados.`,
      );
      break;
    }
    case 'subir': {
      const r = await subirParaHub({ limite });
      console.log(`\n${r.enviados} enviados · ${r.jaExistiam} já existiam · ${r.falhas} falhas.`);
      break;
    }
    case 'status':
      await status();
      break;
    default:
      console.log(
        'Comandos: coletar [--rapido] | enriquecer | filtrar | imagens | lotes | consolidar | subir | status',
      );
      process.exitCode = 1;
  }
}

principal().catch((erro) => {
  console.error('\nFalhou:', erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
