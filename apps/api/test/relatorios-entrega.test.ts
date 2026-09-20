import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfiguracaoRelatorios, EnvioRelatorio } from '@prisma/client';
import { ConfiguracaoRelatoriosUpdateSchema } from '@mahou-hub/contracts';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { FinanceiroService } from '../src/modules/financeiro/financeiro.service';
import { RelatoriosConfiguracaoService } from '../src/modules/relatorios/relatorios-configuracao.service';
import { RelatoriosService } from '../src/modules/relatorios/relatorios.service';
import { enviarAoGoogle } from '../src/modules/relatorios/relatorios-google';
import { cifrarSegredo, decifrarSegredo } from '../src/modules/relatorios/relatorios-segredo';
const agora = new Date('2026-09-20T15:00:00.000Z');
const segredo = 'segredo-exclusivo-dos-testes';
const webhookUrl = 'https://script.google.com/macros/s/deployment-test/exec';
const planilhaUrl = 'https://docs.google.com/spreadsheets/d/planilha-test/edit';
const entrada = { periodo: 'MENSAL' as const, referencia: '2026-08-15' };
const respostaGoogle = () =>
  Response.json({ ok: true, planilhaUrl, enviadoEm: agora.toISOString() });

function configuracao(overrides: Partial<ConfiguracaoRelatorios> = {}): ConfiguracaoRelatorios {
  return {
    id: 1,
    ativo: false,
    emailGoogle: 'dono@example.com',
    destinatarios: ['destino@example.com'],
    webhookUrl,
    segredoCifrado: cifrarSegredo(segredo),
    ultimoAgendamentoEm: agora,
    atualizadoEm: agora,
    ...overrides,
  };
}

function envio(overrides: Partial<EnvioRelatorio> = {}): EnvioRelatorio {
  return {
    id: 'envio1',
    chave: 'MENSAL:2026-08-01:2026-08-31',
    periodo: 'MENSAL',
    inicio: '2026-08-01',
    fim: '2026-08-31',
    status: 'PENDENTE',
    relatorio: { titulo: 'Agosto de 2026', vendas: [{ observacao: 'Nota com acento e\nlinha' }] },
    destinatarios: ['destino@example.com'],
    tentativas: 0,
    proximaTentativaEm: agora,
    processamentoEm: null,
    planilhaUrl: null,
    erro: null,
    criadoEm: agora,
    enviadoEm: null,
    ...overrides,
  };
}

function prepararConfiguracao(config: ConfiguracaoRelatorios | null = configuracao()) {
  const prisma = {
    configuracaoRelatorios: {
      findUnique: vi.fn().mockResolvedValue(config),
      update: vi.fn(async ({ data }: { data: Partial<ConfiguracaoRelatorios> }) => ({
        ...config,
        ...data,
      })),
      upsert: vi
        .fn()
        .mockImplementation(async ({ create, update }) => ({ ...(config ?? create), ...update })),
    },
  };
  return { prisma, service: new RelatoriosConfiguracaoService(prisma as unknown as PrismaService) };
}

function prepararFila(config = configuracao()) {
  const registros = new Map<string, EnvioRelatorio>();
  const delegate = {
    findUnique: vi.fn(
      async ({ where }: { where: { chave: string } }) => registros.get(where.chave) ?? null,
    ),
    upsert: vi.fn(async ({ create }: { create: Partial<EnvioRelatorio> & { chave: string } }) => {
      if (!registros.has(create.chave))
        registros.set(create.chave, envio({ ...create, id: `e${registros.size}` }));
      return { ...registros.get(create.chave)! };
    }),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id?: string; status?: string; tentativas?: { gte?: number } };
        data: { status: string; erro?: string };
      }) => {
        if (!where.id) {
          const expirados = [...registros.values()].filter(
            (r) =>
              r.status === where.status &&
              r.tentativas >= (where.tentativas?.gte ?? Infinity) &&
              Number(r.processamentoEm) < Date.now() - 10 * 60000,
          );
          expirados.forEach((r) => Object.assign(r, data));
          return { count: expirados.length };
        }
        const registro = [...registros.values()].find((r) => r.id === where.id);
        if (
          !registro ||
          registro.status === 'ENVIADO' ||
          (registro.status === 'PROCESSANDO' &&
            Number(registro.processamentoEm) >= Date.now() - 10 * 60000)
        )
          return { count: 0 };
        registro.status = 'PROCESSANDO';
        registro.tentativas++;
        registro.processamentoEm = new Date();
        return { count: 1 };
      },
    ),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<EnvioRelatorio> }) => {
        const registro = [...registros.values()].find((r) => r.id === where.id)!;
        Object.assign(registro, data);
        return registro;
      },
    ),
  };
  const prisma = {
    envioRelatorio: delegate,
    configuracaoRelatorios: {
      findUnique: vi.fn().mockResolvedValue(config),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const financeiro = { relatorio: vi.fn(async () => ({ titulo: 'Agosto de 2026' })) };
  const service = new RelatoriosService(
    prisma as unknown as PrismaService,
    financeiro as unknown as FinanceiroService,
  );
  return { prisma, delegate, registros, financeiro, service };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(agora);
  vi.stubEnv('JWT_SECRET', 'chave-local-sem-valor-real');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => respostaGoogle()),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('configuração e segredo dos relatórios', () => {
  it('GET expõe somente configuração pública, nunca chave cifrada ou código Google', async () => {
    const config = configuracao();
    const { service } = prepararConfiguracao(config);
    const resultado = await service.get();
    expect(resultado).toEqual({
      ativo: false,
      googleConfigurado: true,
      emailGoogle: config.emailGoogle,
      destinatarios: config.destinatarios,
      webhookUrl,
      horario: '08:00',
      timezone: 'America/Bahia',
    });
    expect(JSON.stringify(resultado)).not.toContain(segredo);
    expect(JSON.stringify(resultado)).not.toContain(config.segredoCifrado);
  });

  it('não ativa automaticamente antes de conectar uma implantação', async () => {
    const { service, prisma } = prepararConfiguracao(null);
    await expect(
      service.salvar({
        emailGoogle: 'dono@example.com',
        destinatarios: ['destino@example.com'],
        ativo: true,
      }),
    ).rejects.toThrow('Conecte o Google');
    expect(prisma.configuracaoRelatorios.upsert).not.toHaveBeenCalled();
  });

  it.each([
    { emailGoogle: 'outra@example.com', destinatarios: ['destino@example.com'] },
    { emailGoogle: 'dono@example.com', destinatarios: ['novo@example.com'] },
  ])('mudança de identidade invalida a implantação e troca o segredo', async (identidade) => {
    const config = configuracao();
    const { service, prisma } = prepararConfiguracao(config);
    const resultado = await service.salvar({ ...identidade, webhookUrl, ativo: false });
    const alteracao = prisma.configuracaoRelatorios.upsert.mock.calls[0]![0].update;
    expect(resultado).toMatchObject({ googleConfigurado: false, webhookUrl: null });
    expect(decifrarSegredo(alteracao.segredoCifrado)).not.toBe(segredo);
  });

  it('preserva chave e implantação ao editar somente ativação', async () => {
    const config = configuracao();
    const { service, prisma } = prepararConfiguracao(config);
    await service.salvar({
      emailGoogle: config.emailGoogle,
      destinatarios: config.destinatarios,
      ativo: true,
    });
    expect(prisma.configuracaoRelatorios.upsert.mock.calls[0]![0].update).toMatchObject({
      segredoCifrado: config.segredoCifrado,
      webhookUrl,
      ultimoAgendamentoEm: agora,
    });
  });

  it('normaliza e deduplica emails antes da comparação de identidade', () => {
    expect(
      ConfiguracaoRelatoriosUpdateSchema.parse({
        emailGoogle: ' DONO@example.com ',
        destinatarios: ['Z@example.com', ' a@example.com ', 'A@example.com'],
        ativo: false,
      }).destinatarios,
    ).toEqual(['a@example.com', 'z@example.com']);
  });

  it('cifra com IV aleatório e detecta adulteração ou rotação da chave do servidor', () => {
    const cifrado = cifrarSegredo(segredo);
    expect(cifrarSegredo(segredo)).not.toBe(cifrado);
    expect(decifrarSegredo(cifrado)).toBe(segredo);
    const partes = cifrado.split('.');
    partes[2] = Buffer.from('corpo adulterado').toString('base64url');
    expect(() => decifrarSegredo(partes.join('.'))).toThrow();
    vi.stubEnv('JWT_SECRET', 'outra-chave');
    expect(() => decifrarSegredo(cifrado)).toThrow();
  });

  it('exige chave do servidor e configuração antes de gerar o código da integração', async () => {
    const { service } = prepararConfiguracao(null);
    await expect(service.codigo()).rejects.toThrow('Salve a conta Google');
    vi.stubEnv('JWT_SECRET', '');
    expect(() => cifrarSegredo()).toThrow('JWT_SECRET');
  });

  it('preparar integração após rotação JWT gera nova chave e exige reconectar', async () => {
    const { service, prisma } = prepararConfiguracao(configuracao({ ativo: true }));
    vi.stubEnv('JWT_SECRET', 'nova-chave-do-servidor');
    const resultado = await service.codigo();
    const alteracao = prisma.configuracaoRelatorios.update.mock.calls[0]![0].data;
    expect(alteracao).toMatchObject({ ativo: false, webhookUrl: null });
    const novaChave = decifrarSegredo(alteracao.segredoCifrado!);
    expect(novaChave).not.toBe(segredo);
    expect(resultado.codigo).toContain(novaChave);
  });
});

describe('HTTP e assinatura para Google', () => {
  it('assina exatamente o JSON enviado, incluindo id estável, destinatários e acentos', async () => {
    const relatorio = envio();
    await enviarAoGoogle(configuracao(), relatorio);
    const [url, opcoes] = vi.mocked(fetch).mock.calls[0]!;
    const envelope = JSON.parse(String(opcoes?.body)) as { conteudo: string; assinatura: string };
    expect(url).toBe(webhookUrl);
    expect(opcoes).toMatchObject({ method: 'POST', redirect: 'manual' });
    expect(envelope.assinatura).toBe(
      createHmac('sha256', segredo).update(envelope.conteudo).digest('hex'),
    );
    expect(JSON.parse(envelope.conteudo)).toEqual({
      id: relatorio.id,
      criadoEm: agora.toISOString(),
      relatorio: relatorio.relatorio,
      destinatarios: relatorio.destinatarios,
    });
    expect(JSON.stringify(envelope)).not.toContain(segredo);
  });

  it.each([
    'http://127.0.0.1/private',
    'https://script.google.com.evil.test/macros/s/x/exec',
    'https://script.google.com@127.0.0.1/macros/s/x/exec',
    'https://script.google.com/macros/s/x/dev',
    'https://script.google.com/macros/s/x/exec?url=http://localhost',
  ])('recusa URL fora da implantação: %s', async (url) => {
    await expect(enviarAoGoogle(configuracao({ webhookUrl: url }), envio())).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('segue somente o redirect Google de conteúdo, sem repetir o payload secreto', async () => {
    const urlConteudo = 'https://script.googleusercontent.com/macros/echo?user_content_key=test';
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: urlConteudo } }),
    );
    expect(await enviarAoGoogle(configuracao(), envio())).toMatchObject({ ok: true, planilhaUrl });
    expect(String(vi.mocked(fetch).mock.calls[1]![0])).toBe(urlConteudo);
    expect(vi.mocked(fetch).mock.calls[1]![1]).toMatchObject({ redirect: 'error' });
    expect(vi.mocked(fetch).mock.calls[1]![1]?.body).toBeUndefined();
  });

  it.each([
    'http://script.googleusercontent.com/x',
    'https://127.0.0.1/x',
    'https://accounts.google.com/login',
    'https://script.googleusercontent.com.evil.test/x',
  ])('bloqueia redirect para %s', async (location) => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location } }),
    );
    await expect(enviarAoGoogle(configuracao(), envio())).rejects.toThrow('exige login');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [() => new Response('falha', { status: 503 }), 'HTTP 503'],
    [
      () => new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }),
      'não retornou JSON',
    ],
    [() => Response.json({ ok: false, erro: 'Cota esgotada' }), 'Cota esgotada'],
    [
      () =>
        Response.json({
          ok: true,
          planilhaUrl: 'https://evil.test/x',
          enviadoEm: agora.toISOString(),
        }),
      'Invalid',
    ],
  ])('não confirma resposta inválida do destino', async (resposta, mensagem) => {
    vi.mocked(fetch).mockResolvedValueOnce(resposta());
    await expect(enviarAoGoogle(configuracao(), envio())).rejects.toThrow(mensagem);
  });
});

describe('fila persistida de entrega', () => {
  it('retorna PROCESSANDO imediatamente e confirma a entrega pelo fluxo real de HTTP', async () => {
    const { service, registros, delegate } = prepararFila();
    const resultado = await service.enviar(entrada);
    expect(resultado.status).toBe('PROCESSANDO');
    await vi.waitFor(() => expect([...registros.values()][0]?.status).toBe('ENVIADO'));
    expect(delegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'ENVIADO',
          planilhaUrl,
          enviadoEm: agora.toISOString(),
        },
      }),
    );
  });

  it('claim atômico permite somente uma chamada Google para duas solicitações simultâneas', async () => {
    const { service, registros, delegate } = prepararFila();
    await Promise.all([service.enviar(entrada), service.enviar(entrada)]);
    await vi.waitFor(() => expect([...registros.values()][0]?.status).toBe('ENVIADO'));
    expect(registros.size).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(delegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { status: { in: ['PENDENTE', 'FALHOU'] } },
            {
              status: 'PROCESSANDO',
              processamentoEm: { lt: new Date(agora.getTime() - 10 * 60000) },
            },
          ],
        }),
      }),
    );
  });

  it('reenviar período concluído conserva snapshot e não repete email', async () => {
    const { service, registros, financeiro } = prepararFila();
    const anterior = envio({ status: 'ENVIADO', planilhaUrl, enviadoEm: agora });
    registros.set(anterior.chave, anterior);
    expect(await service.enviar(entrada)).toMatchObject({ status: 'ENVIADO', planilhaUrl });
    expect(financeiro.relatorio).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('guarda falha e retoma o envio manual mesmo com agendamento inativo', async () => {
    const { service, registros, delegate } = prepararFila();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Rede indisponível'));
    await service.enviar(entrada);
    await vi.waitFor(() => expect([...registros.values()][0]?.status).toBe('FALHOU'));
    const falhou = [...registros.values()][0]!;
    expect(falhou).toMatchObject({
      erro: 'Rede indisponível',
      tentativas: 1,
    });
    expect((falhou.proximaTentativaEm.getTime() - Date.now()) / 60000).toBeCloseTo(15, 2);
    vi.setSystemTime(falhou.proximaTentativaEm);
    delegate.findMany.mockResolvedValueOnce([{ ...falhou }]);
    await service.agendar();
    expect(falhou.status).toBe('ENVIADO');
    const ids = vi
      .mocked(fetch)
      .mock.calls.map(([, opts]) => JSON.parse(JSON.parse(String(opts?.body)).conteudo).id);
    expect(new Set(ids).size).toBe(1);
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tentativas: { lt: 5 },
          proximaTentativaEm: { lte: falhou.proximaTentativaEm },
        }),
      }),
    );
  });

  it('não envia snapshot antigo para destinatários alterados', async () => {
    const { service, registros } = prepararFila(
      configuracao({ destinatarios: ['novo@example.com'] }),
    );
    const anterior = envio();
    registros.set(anterior.chave, anterior);
    await service.enviar(entrada);
    await vi.waitFor(() => expect(anterior.status).toBe('FALHOU'));
    expect(anterior.erro).toContain('destinatários mudaram');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('mantém uma prévia por dia da Bahia e um fechamento separado por período', async () => {
    const { service, registros, financeiro } = prepararFila();
    const mensal = { periodo: 'MENSAL' as const, referencia: '2026-09-01' };
    await service.enviar(mensal);
    await vi.waitFor(() => expect([...registros.values()][0]?.status).toBe('ENVIADO'));
    await service.enviar(mensal);
    expect(registros.size).toBe(1);
    vi.setSystemTime(new Date('2026-09-21T02:59:59.000Z'));
    await service.enviar(mensal);
    expect(registros.size).toBe(1);
    vi.setSystemTime(new Date('2026-09-21T03:00:00.000Z'));
    await service.enviar(mensal);
    await vi.waitFor(() => expect([...registros.values()][1]?.status).toBe('ENVIADO'));
    vi.setSystemTime(new Date('2026-10-01T11:00:00.000Z'));
    await service.enviar(mensal);
    await vi.waitFor(() => expect([...registros.values()][2]?.status).toBe('ENVIADO'));
    expect([...registros.keys()]).toEqual([
      'MENSAL:2026-09-01:2026-09-30:PREVIA:2026-09-20',
      'MENSAL:2026-09-01:2026-09-30:PREVIA:2026-09-21',
      'MENSAL:2026-09-01:2026-09-30',
    ]);
    expect(financeiro.relatorio).toHaveBeenCalledTimes(3);
    expect([...registros.values()][0]!.relatorio).toMatchObject({
      titulo: expect.stringContaining('Prévia de 20/09/2026'),
    });
  });

  it('recupera um processamento abandonado depois de dez minutos usando o mesmo id', async () => {
    const { service, registros, delegate } = prepararFila();
    const interrompido = envio({
      status: 'PROCESSANDO',
      tentativas: 1,
      processamentoEm: new Date(agora.getTime() - 11 * 60000),
    });
    registros.set(interrompido.chave, interrompido);
    delegate.findMany.mockResolvedValueOnce([{ ...interrompido }]);
    await service.agendar();
    expect(interrompido.status).toBe('ENVIADO');
    expect(delegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'envio1', tentativas: { lt: 5 } }),
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('interrupção na quinta tentativa vira falha explícita e permite reconciliação manual', async () => {
    const { service, registros, delegate } = prepararFila();
    const interrompido = envio({
      status: 'PROCESSANDO',
      tentativas: 5,
      processamentoEm: new Date(agora.getTime() - 11 * 60000),
    });
    registros.set(interrompido.chave, interrompido);
    await service.agendar();
    expect(interrompido.status).toBe('FALHOU');
    expect(interrompido.erro).toContain('última tentativa');
    expect(fetch).not.toHaveBeenCalled();
    await service.enviar(entrada);
    await vi.waitFor(() => expect(interrompido.status).toBe('ENVIADO'));
    expect(delegate.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'envio1' }),
      }),
    );
  });

  it('sem implantação não envia nem processa a fila', async () => {
    const { service, financeiro, delegate } = prepararFila(configuracao({ webhookUrl: null }));
    await expect(service.enviar(entrada)).rejects.toThrow('Conecte a conta Google');
    await service.agendar();
    expect(financeiro.relatorio).not.toHaveBeenCalled();
    expect(delegate.findMany).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejeita período futuro sem gerar snapshot nem chamar Google', async () => {
    const { service, financeiro } = prepararFila();
    await expect(service.enviar({ periodo: 'ANUAL', referencia: '2027-01-01' })).rejects.toThrow(
      'já iniciado',
    );
    expect(financeiro.relatorio).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
