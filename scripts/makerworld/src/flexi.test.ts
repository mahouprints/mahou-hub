import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import type { ModeloDetalhe, ModeloListagem, PerfilImpressao } from './client.js';
import { enviarPayloadFlexi, lerOpcoesFlexi } from './flexi.js';
import { paraPayloadFlexi, pareceFlexi, selecionarFlexi } from './flexi-selecao.js';

const modelo: ModeloListagem = {
  id: 123,
  title: 'Flexi tiny dragon',
  slug: 'flexi-tiny-dragon',
  cover: 'https://example.com/design.jpg',
  likeCount: 10,
  collectionCount: 20,
  printCount: 5,
  downloadCount: 100,
  commentCount: 2,
  createTime: '2026-09-21',
  hotScore: 1,
  nsfw: false,
  license: 'BY',
  tags: ['dragon'],
  isExclusive: false,
  isAIGC: false,
  designCreator: { name: 'Autor' },
};

function perfil(campos: Partial<PerfilImpressao> = {}): PerfilImpressao {
  return {
    id: 55,
    title: 'Perfil pequeno',
    weight: 20,
    prediction: 3600,
    materialCnt: 1,
    materialColorCnt: 1,
    needAms: false,
    downloadCount: 10,
    pictures: [{ url: 'https://example.com/perfil-pequeno.jpg', isRealLifePhoto: 1 }],
    ...campos,
  };
}

function detalhe(instances: PerfilImpressao[], campos: Partial<ModeloDetalhe> = {}): ModeloDetalhe {
  return {
    id: 123,
    title: modelo.title,
    slug: modelo.slug,
    summary: '',
    license: 'BY',
    nsfw: false,
    isAIGC: false,
    allowReCreation: true,
    categories: [],
    instances,
    ...campos,
  };
}

function candidatoPadrao() {
  const resultado = selecionarFlexi(modelo, detalhe([perfil()]));
  assert.ok('candidato' in resultado);
  return resultado.candidato;
}

describe('seleção flexi conserva a evidência do perfil', () => {
  it('aceita exatamente 60g e 2h sem arredondar valores que excedem o teto', () => {
    assert.ok(
      'candidato' in selecionarFlexi(modelo, detalhe([perfil({ weight: 60, prediction: 7200 })])),
    );
    assert.ok('motivos' in selecionarFlexi(modelo, detalhe([perfil({ weight: 60.001 })])));
    assert.ok('motivos' in selecionarFlexi(modelo, detalhe([perfil({ prediction: 7201 })])));
  });

  it('recusa métricas ausentes, zero, infinitas ou NaN', () => {
    for (const weight of [undefined, null, 0, -1, Infinity, NaN]) {
      const resultado = selecionarFlexi(modelo, detalhe([perfil({ weight: weight as number })]));
      assert.deepEqual(resultado, { motivos: ['SEM_PESO_OU_TEMPO_VALIDO'] });
    }
    assert.ok(
      'motivos' in
        selecionarFlexi(modelo, detalhe([perfil({ prediction: undefined as unknown as number })])),
    );
  });

  it('não combina peso de um perfil com tempo de outro', () => {
    const resultado = selecionarFlexi(
      modelo,
      detalhe([
        perfil({ weight: 20, prediction: 10800 }),
        perfil({ weight: 70, prediction: 1800 }),
      ]),
    );
    assert.deepEqual(resultado, { motivos: ['NENHUM_PERFIL_DENTRO_DOS_LIMITES'] });
  });

  it('rejeita detalhe vazio ou de outro modelo mesmo com resposta HTTP 200', () => {
    assert.deepEqual(selecionarFlexi(modelo, detalhe([perfil()], { id: 0, title: '' })), {
      motivos: ['DETALHE_INVALIDO'],
    });
    assert.deepEqual(selecionarFlexi(modelo, detalhe([perfil()], { id: 456 })), {
      motivos: ['DETALHE_INVALIDO'],
    });
  });

  it('prefere bico 0,4 entre perfis equivalentes; outro bico continua revisável', () => {
    const fino = perfil({
      id: 56,
      prediction: 300,
      extention: {
        modelInfo: {
          compatibility: { nozzleDiameter: 0.2 },
        },
      },
    });
    const padrao = perfil({
      id: 57,
      extention: {
        modelInfo: {
          compatibility: { nozzleDiameter: 0.4 },
        },
      },
    });
    const resultado = selecionarFlexi(modelo, detalhe([fino, padrao]));
    assert.ok('candidato' in resultado);
    assert.equal(resultado.candidato.perfil.id, '57');
    const unico = selecionarFlexi(modelo, detalhe([fino]));
    assert.ok('candidato' in unico);
    assert.ok(paraPayloadFlexi(unico.candidato).alertas.includes('NOZZLE_DIFERENTE_0_4'));
  });

  it('prioriza multicor elegível e usa a foto do mesmo perfil', () => {
    const resultado = selecionarFlexi(
      modelo,
      detalhe([
        perfil({ weight: 8, prediction: 600 }),
        perfil({
          id: 56,
          materialColorCnt: 3,
          weight: 40,
          prediction: 5400,
          pictures: [{ url: 'https://example.com/tres-cores.jpg', isRealLifePhoto: 0 }],
        }),
        perfil({
          id: 57,
          materialColorCnt: 5,
          weight: 200,
          pictures: [{ url: 'https://example.com/perfil-pesado.jpg', isRealLifePhoto: 1 }],
        }),
      ]),
    );
    assert.ok('candidato' in resultado);
    assert.equal(resultado.candidato.perfil.id, '56');
    assert.equal(resultado.candidato.perfil.gramas, 40);
    assert.deepEqual(resultado.candidato.perfil.imagens, ['https://example.com/tres-cores.jpg']);
    assert.equal(resultado.candidato.perfil.temFotoReal, false);
    assert.match(resultado.candidato.url, /#profileId-56$/);
  });

  it('prefere perfil normal mais usado a uma variante mini mais rápida dentro do teto', () => {
    const configuracao = { modelInfo: { compatibility: { nozzleDiameter: 0.4 } } };
    const mini = perfil({
      id: 56,
      title: 'Mini 50%',
      weight: 3,
      prediction: 1800,
      downloadCount: 54,
      extention: configuracao,
    });
    const normal = perfil({
      id: 57,
      title: 'Normal 100%',
      weight: 17,
      prediction: 3800,
      downloadCount: 23605,
      extention: configuracao,
    });
    const resultado = selecionarFlexi(modelo, detalhe([mini, normal]));
    assert.ok('candidato' in resultado);
    assert.equal(resultado.candidato.perfil.id, '57');
    assert.equal(resultado.candidato.perfil.downloads, 23605);
    assert.equal(resultado.candidato.perfil.gramas, 17);
  });

  it('normaliza downloads do perfil ausentes ou inválidos sem contaminar a ordenação', () => {
    for (const downloadCount of [undefined, NaN, Infinity, -1]) {
      const resultado = selecionarFlexi(modelo, detalhe([perfil({ downloadCount })]));
      assert.ok('candidato' in resultado);
      assert.equal(resultado.candidato.perfil.downloads, 0);
    }
  });

  it('não usa a capa geral quando somente o perfil pesado possui fotos', () => {
    const resultado = selecionarFlexi(
      modelo,
      detalhe([perfil({ pictures: [] }), perfil({ weight: 80 })]),
    );
    assert.deepEqual(resultado, { motivos: ['SEM_IMAGEM_DO_PERFIL_VIAVEL'] });
  });

  it('não infere cores da quantidade de materiais ou do título', () => {
    const resultado = selecionarFlexi(
      modelo,
      detalhe([
        perfil({ title: 'Rainbow multicolor', materialCnt: 4, materialColorCnt: undefined }),
      ]),
    );
    assert.ok('candidato' in resultado);
    assert.equal(resultado.candidato.perfil.cores, null);
    assert.equal(paraPayloadFlexi(resultado.candidato).tags.includes('MULTICOR_PROVAVEL'), false);
  });

  it('mantém AMS sem purga informada pendente, impedindo importação', () => {
    const resultado = selecionarFlexi(
      modelo,
      detalhe([perfil({ needAms: true, materialColorCnt: 4 })]),
    );
    assert.ok('candidato' in resultado);
    assert.deepEqual(resultado.candidato.pendencias, ['PURGA_NAO_INFORMADA']);
    assert.throws(() => paraPayloadFlexi(resultado.candidato), /pendências/);
  });

  it('prefere um perfil sem AMS verificável a um perfil com consumo de purga desconhecido', () => {
    const resultado = selecionarFlexi(
      modelo,
      detalhe([perfil({ id: 56, needAms: true, materialColorCnt: 4 }), perfil({ id: 57 })]),
    );
    assert.ok('candidato' in resultado);
    assert.equal(resultado.candidato.perfil.id, '57');
    assert.deepEqual(resultado.candidato.pendencias, []);
  });

  it('a licença do detalhe prevalece e licença desconhecida nunca passa', () => {
    for (const license of ['Standard Digital File License', 'BY-NC', 'desconhecida', '']) {
      assert.ok('motivos' in selecionarFlexi(modelo, detalhe([perfil()], { license })));
    }
    const resultado = selecionarFlexi(modelo, detalhe([perfil()], { license: 'BY-SA' }));
    assert.ok('candidato' in resultado);
    assert.equal(paraPayloadFlexi(resultado.candidato).licenca, 'BY-SA');
  });

  it('reconhece articulados por título/tags, mas não chama todo brinquedo de flexi', () => {
    assert.equal(pareceFlexi('Articulated cat'), true);
    assert.equal(pareceFlexi('Gato', ['articulado']), true);
    assert.equal(pareceFlexi('Solid toy car'), false);
    assert.ok(
      'motivos' in selecionarFlexi(modelo, detalhe([perfil()], { title: 'Solid toy car' })),
    );
  });

  it('exporta unidade, origem e revisão explícita, sem avaliação IA fabricada', () => {
    const payload = paraPayloadFlexi(candidatoPadrao());
    assert.equal(payload.unidadesPorKit, 1);
    assert.equal(payload.pesoGramas, 20);
    assert.equal(payload.tempoHoras, 1);
    assert.equal(payload.notaIa, 0);
    assert.equal(payload.veredictoIa, 'TALVEZ');
    assert.ok(payload.tags.includes('SEM_AVALIACAO_VISUAL'));
    assert.ok(payload.tags.includes('flexi-60g'));
    assert.match(payload.justificativaIa, /Perfil 55/);
    assert.match(payload.justificativaIa, /sem avaliação visual\/IA/);
    assert.ok(payload.custoEstimadoCentavos > 0);
  });

  it('identifica arquivo local sem inventar horário de consulta à API', () => {
    const candidato = candidatoPadrao();
    candidato.coletadoEm = null;
    candidato.arquivoOrigem = 'dados/amostras/123.json';
    candidato.arquivoModificadoEm = '2026-09-21T15:00:00Z';
    const payload = paraPayloadFlexi(candidato);
    assert.equal(candidato.arquivoOrigem, 'dados/amostras/123.json');
    assert.match(payload.justificativaIa, /Dados de arquivo salvo em 2026-09-21T15:00:00Z/);
    assert.match(payload.justificativaIa, /sem atualização nesta execução/);
    assert.doesNotMatch(payload.justificativaIa, /dados\/amostras\/123.json/);
    assert.doesNotMatch(payload.justificativaIa, /Consulta à API em/);
  });
});

describe('comandos flexi', () => {
  it('valida teto de 60g e argumentos antes de iniciar a coleta', () => {
    assert.deepEqual(lerOpcoesFlexi([]).limites, { gramas: 60, horas: 2 });
    assert.equal(lerOpcoesFlexi(['--max-horas', '1.5']).limites.horas, 1.5);
    assert.deepEqual(lerOpcoesFlexi(['--ids', '123,456,123']).ids, [123, 456]);
    for (const args of [
      ['--max-horas'],
      ['--max-horas', '0'],
      ['--max-gramas', '61'],
      ['--paginas', '1.5'],
      ['--limite', '201'],
      ['--ids', 'abc'],
      ['--ids', '0'],
    ]) {
      assert.throws(() => lerOpcoesFlexi(args));
    }
  });

  it('não envia requisição na simulação nem sem token', async () => {
    const requisicao = mock.method(globalThis, 'fetch', async () => {
      throw new Error('Rede indevida');
    });
    try {
      const modelos = [paraPayloadFlexi(candidatoPadrao())];
      await enviarPayloadFlexi(modelos, { confirmar: false });
      await assert.rejects(enviarPayloadFlexi(modelos, { confirmar: true }), /TOKEN ausente/);
      assert.equal(requisicao.mock.callCount(), 0);
    } finally {
      requisicao.mock.restore();
    }
  });

  it('usa bulk-import autenticado em lotes de no máximo 100', async () => {
    const lotes: number[] = [];
    const requisicao = mock.method(
      globalThis,
      'fetch',
      async (url: string | URL | Request, init?: RequestInit) => {
        assert.equal(url, 'https://hub.test/api/v1/makerworld/bulk-import');
        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer teste');
        const enviados = JSON.parse(String(init?.body)) as { modelos: unknown[] };
        lotes.push(enviados.modelos.length);
        return Response.json({ criados: enviados.modelos.length, atualizados: 0 });
      },
    );
    try {
      const modelos = Array.from({ length: 101 }, () => paraPayloadFlexi(candidatoPadrao()));
      const resultado = await enviarPayloadFlexi(modelos, {
        confirmar: true,
        base: 'https://hub.test/api/v1/',
        token: 'teste',
      });
      assert.deepEqual(lotes, [100, 1]);
      assert.deepEqual(resultado, { criados: 101, atualizados: 0 });
    } finally {
      requisicao.mock.restore();
    }
  });

  it('interrompe no erro do servidor sem declarar importação bem-sucedida', async () => {
    const requisicao = mock.method(
      globalThis,
      'fetch',
      async () => new Response('', { status: 401 }),
    );
    try {
      await assert.rejects(
        enviarPayloadFlexi([paraPayloadFlexi(candidatoPadrao())], {
          confirmar: true,
          token: 'teste',
        }),
        /HTTP 401/,
      );
      assert.equal(requisicao.mock.callCount(), 1);
    } finally {
      requisicao.mock.restore();
    }
  });
});
