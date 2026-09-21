import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ModeloDetalhe, ModeloListagem, PerfilImpressao } from './client.js';
import { LIMITES_FLEXI, paraPayloadFlexi, selecionarFlexi } from './flexi-selecao.js';
import { lerOpcoesFlexi, payloadDoRelatorio } from './flexi.js';

const modelo: ModeloListagem = {
  id: 123,
  title: 'Flexi colorido',
  slug: 'flexi-colorido',
  cover: '',
  likeCount: 1,
  collectionCount: 1,
  printCount: 1,
  downloadCount: 100,
  commentCount: 0,
  createTime: '',
  hotScore: 1,
  nsfw: false,
  license: 'BY',
  tags: [],
  isExclusive: false,
  isAIGC: false,
  designCreator: { uid: 7, name: 'Autor' },
};

function perfil(campos: Partial<PerfilImpressao> = {}): PerfilImpressao {
  return {
    id: 1,
    title: 'Perfil com contraste',
    weight: 30,
    prediction: 3600,
    materialCnt: 2,
    materialColorCnt: 2,
    needAms: true,
    downloadCount: 10,
    instanceCreator: { uid: 7 },
    pictures: [{ url: 'https://example.com/colorido.jpg', isRealLifePhoto: 1 }],
    instanceFilaments: [
      { color: '#FF0000', usedG: '20' },
      { color: '#000000', usedG: '10' },
    ],
    ...campos,
  };
}

function detalhe(instances: PerfilImpressao[], license = 'BY'): ModeloDetalhe {
  return {
    id: 123,
    title: modelo.title,
    slug: modelo.slug,
    summary: '',
    license,
    nsfw: false,
    isAIGC: false,
    allowReCreation: true,
    categories: [],
    instances,
    designCreator: modelo.designCreator,
  };
}

function selecionarMaquina(instances: PerfilImpressao[], license = 'BY') {
  return selecionarFlexi(modelo, detalhe(instances, license), LIMITES_FLEXI, true);
}

describe('inspirações coloridas para máquina de sorteio', () => {
  it('inclui licença restrita honestamente somente no novo modo', () => {
    const fonte = detalhe([perfil()], 'Standard Digital File License');
    assert.ok('motivos' in selecionarFlexi(modelo, fonte));
    const resultado = selecionarMaquina(fonte.instances, fonte.license);
    assert.ok('candidato' in resultado);
    const payload = paraPayloadFlexi(resultado.candidato);
    assert.equal(payload.licenca, fonte.license);
    assert.equal(payload.licencaVeredicto, 'PROIBIDA');
    assert.ok(payload.alertas.includes('LICENCA_COMERCIAL_PENDENTE'));
    assert.ok(payload.alertas.includes('PURGA_NAO_INFORMADA'));
    assert.ok(payload.tags.includes('maquina-coloridos'));
    assert.equal(payload.tags.includes('flexi-60g'), false);
    assert.equal(payload.veredictoIa, 'TALVEZ');
    assert.equal(payload.notaIa, 0);
    assert.equal(payload.scoreObjetivo, 0);
    assert.equal(payload.unidadesPorKit, 1);
    assert.match(
      payload.justificativaIa,
      /Total com purga ainda não confirmado\. Tamanho a conferir/,
    );
  });

  it('usa o mesmo alerta de dimensões esperado pela interface do Hub', () => {
    const resultado = selecionarMaquina([perfil()]);
    assert.ok('candidato' in resultado);
    const payload = paraPayloadFlexi(resultado.candidato);
    assert.ok(payload.alertas.includes('DIMENSOES_NAO_CONFIRMADAS'));
    assert.equal(payload.alertas.includes('TAMANHO_A_CONFERIR'), false);
  });

  it('preserva licença desconhecida como pendência, sem convertê-la em licença permitida', () => {
    const resultado = selecionarMaquina([perfil()], 'Licença paga do criador');
    assert.ok('candidato' in resultado);
    const payload = paraPayloadFlexi(resultado.candidato);
    assert.equal(payload.licenca, 'Licença paga do criador');
    assert.equal(payload.licencaVeredicto, 'PROIBIDA');
  });

  it('exige duas cores consumidas, não duas entradas do mesmo filamento ou uma cor sem consumo', () => {
    for (const instanceFilaments of [
      [],
      [{ color: '#FF0000', usedG: '20' }],
      [
        { color: '#FF0000', usedG: '20' },
        { color: '#ff0000FF', usedG: '10' },
      ],
      [
        { color: '#FF0000', usedG: '20' },
        { color: '#000000', usedG: '0' },
      ],
    ]) {
      assert.deepEqual(selecionarMaquina([perfil({ instanceFilaments, materialColorCnt: 4 })]), {
        motivos: ['SEM_DUAS_CORES_CONSUMIDAS_NO_PERFIL'],
      });
    }
  });

  it('reconhece partes de cores distintas no mesmo perfil sem AMS', () => {
    const resultado = selecionarMaquina([
      perfil({
        needAms: false,
        instanceFilaments: [],
        extention: {
          modelInfo: {
            plates: [
              {
                index: 1,
                weight: 20,
                prediction: 2400,
                filaments: [{ color: '#FF0000', usedG: '20' }],
              },
              {
                index: 2,
                weight: 10,
                prediction: 1200,
                filaments: [{ color: '#000000', usedG: '10' }],
              },
            ],
          },
        },
      }),
    ]);
    assert.ok('candidato' in resultado);
    assert.deepEqual(resultado.candidato.perfil.coresConsumidas, ['#FF0000', '#000000']);
    assert.equal(resultado.candidato.pendencias.includes('PURGA_NAO_INFORMADA'), false);
    assert.ok(resultado.candidato.pendencias.includes('SEM_AVALIACAO_VISUAL'));
    const payload = paraPayloadFlexi(resultado.candidato);
    assert.equal(payload.pesoGramas, 30);
    assert.match(payload.justificativaIa, /Confirme todas as peças\/placas no fatiador/);
    assert.doesNotMatch(payload.justificativaIa, /purga ainda não confirmado/);
  });

  it('escolhe multicor AMS em vez do monocromático barato e popular', () => {
    const resultado = selecionarMaquina([
      perfil({
        id: 2,
        needAms: false,
        downloadCount: 9999,
        weight: 5,
        prediction: 600,
        materialColorCnt: 1,
        instanceFilaments: [{ color: '#FF0000', usedG: '5' }],
      }),
      perfil(),
    ]);
    assert.ok('candidato' in resultado);
    assert.equal(resultado.candidato.perfil.id, '1');
    assert.equal(resultado.candidato.perfil.gramas, 30);
  });

  it('prioriza cores antes de AMS e autor/uso entre perfis com a mesma quantidade de cores', () => {
    const tresCores = perfil({
      id: 3,
      instanceFilaments: [...perfil().instanceFilaments!, { color: '#FFFFFF', usedG: '2' }],
      instanceCreator: { uid: 99 },
      downloadCount: 1,
    });
    const maisCores = selecionarMaquina([perfil({ needAms: false }), tresCores]);
    assert.ok('candidato' in maisCores);
    assert.equal(maisCores.candidato.perfil.id, '3');
    const doAutor = selecionarMaquina([
      perfil({ id: 2, instanceCreator: { uid: 99 }, downloadCount: 999 }),
      perfil(),
    ]);
    assert.ok('candidato' in doAutor);
    assert.equal(doAutor.candidato.perfil.id, '1');
    const maisUsado = selecionarMaquina([perfil(), perfil({ id: 4, downloadCount: 20 })]);
    assert.ok('candidato' in maisUsado);
    assert.equal(maisUsado.candidato.perfil.id, '4');
  });

  it('não exporta peso/tempo ausentes ou acima dos limites, mesmo com muitas cores', () => {
    for (const campos of [
      { weight: 61 },
      { prediction: 7201 },
      { weight: NaN },
      { prediction: 0 },
    ]) {
      assert.ok('motivos' in selecionarMaquina([perfil(campos)]));
    }
  });

  it('exclui perfis avulsos de olhos e perna, preservando o brinquedo completo multipartes', () => {
    const olhos = perfil({
      id: 1438845,
      title: 'Eco-Friendly Eyes (Black and White one plate)',
      weight: 4,
      prediction: 1056,
      downloadCount: 999,
    });
    const perna = perfil({
      id: 2399249,
      title: 'Snap-on leg for Older Version, 3 walls, 15% infill',
      weight: 10,
      prediction: 2815,
      downloadCount: 999,
    });
    assert.deepEqual(selecionarMaquina([olhos, perna]), {
      motivos: ['SOMENTE_PERFIS_DE_PECAS_AVULSAS'],
    });
    const completo = perfil({
      id: 1354122,
      title: '50% Scale, Multiple Parts, 0.2mm layer, 3 walls, 5% infill',
      weight: 16,
      prediction: 5381,
    });
    const resultado = selecionarMaquina([olhos, perna, completo]);
    assert.ok('candidato' in resultado);
    assert.equal(resultado.candidato.perfil.id, '1354122');
    for (const title of [
      '1 Plate Print by Object / Multipart / New Version / 0.2mm',
      'Farbige Augen und Hörner (AMS)',
      'HEAD HOLE - ALL IN 1 PLATE - 0.2mm, 4 walls, 25% infill',
    ]) {
      assert.ok('candidato' in selecionarMaquina([perfil({ title })]));
    }
    assert.ok('candidato' in selecionarFlexi(modelo, detalhe([{ ...olhos, needAms: false }])));
  });

  it('exporta as inspirações pendentes somente quando o relatório está concluído e é modo máquina', () => {
    const resultado = selecionarMaquina([perfil()]);
    assert.ok('candidato' in resultado);
    const relatorio = {
      geradoEm: '',
      concluida: true,
      opcoes: lerOpcoesFlexi(['--maquina']),
      candidatos: [],
      pendentes: [resultado.candidato],
      rejeitados: [],
    };
    assert.equal(payloadDoRelatorio(relatorio).length, 1);
    assert.equal(payloadDoRelatorio({ ...relatorio, concluida: false }).length, 0);
    assert.equal(payloadDoRelatorio({ ...relatorio, opcoes: lerOpcoesFlexi([]) }).length, 0);
    assert.equal(lerOpcoesFlexi(['--maquina', '--max-horas', '1.5']).limites.horas, 1.5);
    assert.equal(lerOpcoesFlexi(['--ids', '123', '--maquina']).maquina, true);
  });
});
