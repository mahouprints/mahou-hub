import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { detalharModelo, ErroMakerWorldHttp } from './client.js';

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

for (const status of [403, 404, 429]) {
  test(`interrompe HTTP ${status} sem repetir requisições`, async () => {
    let chamadas = 0;
    globalThis.fetch = async () => {
      chamadas++;
      return new Response('', { status });
    };
    await assert.rejects(
      detalharModelo(123),
      (erro: unknown) => erro instanceof ErroMakerWorldHttp && erro.status === status,
    );
    assert.equal(chamadas, 1);
  });
}

test('identifica o coletor e consulta os metadados públicos com timeout', async () => {
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, 'https://makerworld.com/api/v1/design-service/design/123');
    assert.match(new Headers(opcoes?.headers).get('User-Agent') ?? '', /MahouPrintsProspector/);
    assert.ok(opcoes?.signal);
    return Response.json({ id: 123, title: 'Flexi', instances: [] });
  };
  assert.equal((await detalharModelo(123)).id, 123);
});
