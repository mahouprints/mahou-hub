import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { WebhookGoogleSchema } from '@mahou-hub/contracts';
import type { ConfiguracaoRelatorios, EnvioRelatorio } from '@prisma/client';
import { decifrarSegredo } from './relatorios-segredo';

const RespostaGoogleSchema = z.object({
  ok: z.literal(true),
  planilhaUrl: z
    .string()
    .regex(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]+(?:\/edit)?$/),
  enviadoEm: z.string().datetime(),
});

/** Publica somente na implantação Google configurada; não segue redirecionamento arbitrário. */
export async function enviarAoGoogle(config: ConfiguracaoRelatorios, envio: EnvioRelatorio) {
  const url = WebhookGoogleSchema.parse(config.webhookUrl);
  const identificacao = {
    id: envio.id,
    criadoEm: new Date().toISOString(),
    destinatarios: envio.destinatarios,
  };
  const segredo = decifrarSegredo(config.segredoCifrado);
  const assinar = (dados: object) => {
    const conteudo = JSON.stringify(dados);
    const assinatura = createHmac('sha256', segredo).update(conteudo).digest('hex');
    return JSON.stringify({ conteudo, assinatura });
  };
  // O receptor antigo rejeita um envelope sem relatorio antes de criar planilha/email.
  // Não envie o novo relatório para fórmulas antigas que omitiriam os fretes.
  const verificacao = await requisitarGoogle(
    url,
    assinar({ ...identificacao, acao: 'verificarVersao' }),
  );
  const versao = (await verificacao.json()) as {
    ok?: boolean;
    versaoRelatorio?: number;
    erro?: string;
  };
  if (!versao.ok || versao.versaoRelatorio !== 2) {
    throw new Error(
      'Atualize o código e a implantação Google em Configurar envios para incluir fretes e custos pendentes.' +
        (versao.erro ? ` ${versao.erro.slice(0, 200)}` : ''),
    );
  }
  const resposta = await requisitarGoogle(
    url,
    assinar({ ...identificacao, relatorio: envio.relatorio }),
  );
  const corpo = (await resposta.json()) as { ok?: boolean; erro?: string };
  if (!corpo.ok) throw new Error(corpo.erro?.slice(0, 400) || 'Google não confirmou o envio');
  return RespostaGoogleSchema.parse(corpo);
}

async function requisitarGoogle(url: string, body: string): Promise<Response> {
  let resposta = await fetch(url, {
    method: 'POST',
    body,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(240000),
  });
  if ([301, 302, 303].includes(resposta.status)) {
    const destino = new URL(resposta.headers.get('location') ?? '', url);
    if (destino.protocol !== 'https:' || destino.hostname !== 'script.googleusercontent.com')
      throw new Error('A implantação Google exige login ou não permite acesso ao Hub');
    resposta = await fetch(destino, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  }
  if (!resposta.ok) throw new Error(`Google indisponível (HTTP ${resposta.status})`);
  if (!resposta.headers.get('content-type')?.includes('application/json'))
    throw new Error('Google não retornou JSON. Confira a implantação e a autorização da conta');
  return resposta;
}
