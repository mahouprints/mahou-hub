import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import {
  cotacaoMlDaVariacao,
  custosMlDaCotacao,
  type MercadoLivreCotacao,
} from '@mahou-hub/contracts';
import { ProdutoMercadoLivreService } from '../src/modules/produtos/produto-mercado-livre.service';
import type { MercadoLivreService } from '../src/modules/mercado-livre/mercado-livre.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

const agora = Date.parse('2026-10-19T15:00:00Z');
const contexto = {
  categoriaId: 'MLB123',
  tipoAnuncio: 'gold_special' as const,
  modoEnvio: 'me2' as const,
  tipoLogistica: 'drop_off',
  freteGratis: false,
  condicao: 'new' as const,
  pesoGramas: 50,
  alturaCm: 5,
  larguraCm: 10,
  comprimentoCm: 15,
  precoCentavos: 2490,
};
const cotacao: MercadoLivreCotacao = {
  contexto,
  categoriaNome: 'Categoria de teste',
  tarifaCentavos: 411,
  freteCentavos: 1385,
  tarifaFixaCentavos: null,
  percentualTarifa: null,
  cotadoEm: new Date(agora).toISOString(),
  pendencias: [],
};
const produto = { id: 'p1', mercadoLivre: contexto, precoCentavos: 2490, cotacaoMl: cotacao };

describe('validade da cotação ML', () => {
  it('aceita total válido sem breakdown e independe da ordem dos campos', () => {
    const invertida = Object.fromEntries(Object.entries(contexto).reverse());
    expect(custosMlDaCotacao({ ...produto, mercadoLivre: invertida }, agora)).toEqual({
      tarifaCentavos: 411,
      freteCentavos: 1385,
    });
  });

  it('metadados de publicação não alteram o contexto da cotação', () => {
    const mercadoLivre = {
      ...contexto,
      publicacao: {
        versao: 1,
        execucaoId: 'execucao-1',
        status: 'concluido',
        itens: [],
        atualizadoEm: new Date(agora).toISOString(),
      },
    };
    expect(custosMlDaCotacao({ ...produto, mercadoLivre }, agora)).toEqual({
      tarifaCentavos: 411,
      freteCentavos: 1385,
    });
  });

  it.each([
    { precoCentavos: 2500 },
    { mercadoLivre: { ...contexto, categoriaId: 'MLB456' } },
    { mercadoLivre: { ...contexto, tipoAnuncio: 'gold_pro' } },
    { mercadoLivre: { ...contexto, tipoLogistica: 'fulfillment' } },
    { mercadoLivre: { ...contexto, pesoGramas: 100 } },
    { mercadoLivre: { ...contexto, alturaCm: 6 } },
    { mercadoLivre: { ...contexto, freteGratis: true } },
    { mercadoLivre: null },
  ])('rejeita mudança nas condições %j', (mudanca) => {
    expect(custosMlDaCotacao({ ...produto, ...mudanca }, agora)).toBeUndefined();
  });

  it('rejeita cotação vencida ou com data futura', () => {
    expect(custosMlDaCotacao(produto, agora + 86400001)).toBeUndefined();
    expect(custosMlDaCotacao(produto, agora - 1)).toBeUndefined();
  });

  it('distingue frete zero confirmado de frete desconhecido', () => {
    for (const freteCentavos of [0, null]) {
      expect(
        custosMlDaCotacao({ ...produto, cotacaoMl: { ...cotacao, freteCentavos } }, agora),
      ).toEqual({ tarifaCentavos: 411, freteCentavos });
    }
  });
});

const publicacao = {
  versao: 1,
  execucaoId: 'cores',
  status: 'concluido',
  atualizadoEm: new Date(agora).toISOString(),
  itens: ['AZ', 'BR'].map((cor, indice) => ({
    chave: cor,
    itemId: `MLB${100 + indice}`,
    skus: [`PROD-${cor}`],
    descricaoConfirmada: true,
    fiscalConfirmado: true,
    verificado: true,
  })),
};

function produtoPublicado() {
  return {
    ...produto,
    pesoG: 40,
    mercadoLivre: { ...contexto, publicacao: structuredClone(publicacao) },
    variacoes: ['AZ', 'BR'].map((cor) => ({
      id: `v-${cor}`,
      sku: `PROD-${cor}`,
      precoCentavos: null,
      pesoG: null,
      atualizadoEm: new Date(agora),
    })),
    cotacaoMl: {
      ...cotacao,
      porSku: {
        'PROD-AZ': { ...cotacao, contexto: { ...contexto, itemId: 'MLB100' }, freteCentavos: 701 },
        'PROD-BR': { ...cotacao, contexto: { ...contexto, itemId: 'MLB101' }, freteCentavos: 1102 },
      },
    },
  };
}

describe('cotação vinculada ao SKU publicado', () => {
  it('seleciona exclusivamente a cotação da cor e não apresenta margem genérica do produto', () => {
    const publicado = produtoPublicado();
    expect(
      cotacaoMlDaVariacao(publicado, { sku: 'PROD-AZ', precoCentavos: 2490 }, agora)?.freteCentavos,
    ).toBe(701);
    expect(
      cotacaoMlDaVariacao(publicado, { sku: 'PROD-BR', precoCentavos: 2490 }, agora)?.freteCentavos,
    ).toBe(1102);
    expect(custosMlDaCotacao(publicado, agora)).toBeUndefined();
  });

  it('preserva a estimativa anterior para produto ainda não publicado', () => {
    expect(cotacaoMlDaVariacao(produto, { sku: 'PROD-AZ', precoCentavos: 2490 }, agora)).toEqual(
      cotacao,
    );
  });

  it('não empresta anúncio importado sem vínculo de SKU a qualquer cor', () => {
    const mercadoLivre = { ...contexto, itemId: 'MLB777' };
    const importado = {
      ...produto,
      mercadoLivre,
      cotacaoMl: { ...cotacao, contexto: mercadoLivre },
    };
    expect(
      cotacaoMlDaVariacao(importado, { sku: 'PROD-AZ', precoCentavos: 2490 }, agora),
    ).toBeUndefined();
    expect(custosMlDaCotacao(importado, agora)).toEqual({
      tarifaCentavos: 411,
      freteCentavos: 1385,
    });
  });

  it.each([
    { sku: 'NAO-COTADO', precoCentavos: 2490 },
    { sku: 'PROD-AZ', precoCentavos: 2590 },
  ])('não herda cotação de outra cor ou preço: %j', (variacao) => {
    expect(cotacaoMlDaVariacao(produtoPublicado(), variacao, agora)).toBeUndefined();
  });

  it('rejeita cotação vencida, futura, vínculo trocado ou quantidade legada de variações', () => {
    const publicado = produtoPublicado();
    const variacao = { sku: 'PROD-AZ', precoCentavos: 2490 };
    expect(cotacaoMlDaVariacao(publicado, variacao, agora + 86400001)).toBeUndefined();
    expect(cotacaoMlDaVariacao(publicado, variacao, agora - 1)).toBeUndefined();
    publicado.mercadoLivre.publicacao.itens[0]!.itemId = 'MLB999';
    expect(cotacaoMlDaVariacao(publicado, variacao, agora)).toBeUndefined();
    publicado.mercadoLivre.publicacao.itens[0]!.itemId = 'MLB100';
    Object.assign(publicado.mercadoLivre.publicacao.itens[0]!, {
      variationIds: { 'PROD-AZ': '12' },
    });
    expect(cotacaoMlDaVariacao(publicado, variacao, agora)).toBeUndefined();
  });

  it('rejeita cotação inválida ou ausente mesmo havendo estimativa raiz válida', () => {
    const publicado = produtoPublicado();
    const variacao = { sku: 'PROD-AZ', precoCentavos: 2490 };
    expect(
      cotacaoMlDaVariacao({ ...publicado, cotacaoMl: cotacao }, variacao, agora),
    ).toBeUndefined();
    expect(
      cotacaoMlDaVariacao(
        {
          ...publicado,
          cotacaoMl: {
            ...publicado.cotacaoMl,
            porSku: { 'PROD-AZ': { ...cotacao, tarifaCentavos: -1 } },
          },
        },
        variacao,
        agora,
      ),
    ).toBeUndefined();
  });
});

describe('consulta e persistência por SKU', () => {
  function prepararPublicado() {
    const { mock } = makePrismaMock();
    const publicado = produtoPublicado();
    mock.produto.findUnique.mockResolvedValue(publicado);
    mock.produto.updateMany.mockResolvedValue({ count: 1 });
    const ml = {
      cotar: vi.fn(async (entrada: typeof contexto & { itemId?: string }) => ({
        ...structuredClone(cotacao),
        contexto: entrada,
        freteCentavos:
          entrada.itemId === 'MLB100' ? 701 : entrada.itemId === 'MLB101' ? 1102 : 1385,
      })),
      anuncio: vi.fn(async (itemId: string) => ({
        ...contexto,
        tipoAnuncio: String(contexto.tipoAnuncio),
        itemId,
        status: 'active',
        moeda: 'BRL',
        temVariacoes: false,
        sku: itemId === 'MLB100' ? 'PROD-AZ' : 'PROD-BR',
      })),
    };
    return {
      mock,
      ml,
      publicado,
      service: new ProdutoMercadoLivreService(asPrisma(mock), ml as unknown as MercadoLivreService),
    };
  }

  it('consulta cada item próprio e salva resultados independentes com guarda de preço, vínculo e variações', async () => {
    const { mock, ml, publicado, service } = prepararPublicado();
    const resultado = await service.cotar('p1');
    expect(ml.anuncio.mock.calls).toEqual([['MLB100'], ['MLB101']]);
    expect(resultado.porSku?.['PROD-AZ']?.freteCentavos).toBe(701);
    expect(resultado.porSku?.['PROD-BR']?.freteCentavos).toBe(1102);
    expect(mock.produto.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'p1',
          precoCentavos: 2490,
          pesoG: 40,
          mercadoLivre: { equals: publicado.mercadoLivre },
          variacoes: { every: { OR: [{ ativo: false }, ...publicado.variacoes] } },
          AND: publicado.variacoes.map((variacao) => ({
            variacoes: { some: { id: variacao.id, ativo: true } },
          })),
        }),
        data: { cotacaoMl: resultado },
      }),
    );
  });

  it.each([
    { itemId: 'MLB999' },
    { sku: 'OUTRA-COR' },
    { precoCentavos: 2990 },
    { categoriaId: 'MLB456' },
    { tipoLogistica: 'fulfillment' },
    { tipoAnuncio: 'gold_pro' },
    { freteGratis: true },
    { status: 'paused' },
    { moeda: 'USD' },
    { temVariacoes: true },
    { pesoGramas: 999 },
    { alturaCm: 99 },
  ])('mantém uma cor pendente quando o anúncio diverge: %j', async (mudanca) => {
    const { ml, service } = prepararPublicado();
    const original = ml.anuncio.getMockImplementation()!;
    ml.anuncio.mockImplementation(async (itemId) => ({
      ...(await original(itemId)),
      ...(itemId === 'MLB100' ? mudanca : {}),
    }));
    const resultado = await service.cotar('p1');
    expect(resultado.porSku?.['PROD-AZ']).toBeUndefined();
    expect(resultado.porSku?.['PROD-BR']?.freteCentavos).toBe(1102);
    expect(resultado.pendencias.some((pendencia) => pendencia.startsWith('PROD-AZ:'))).toBe(true);
    expect(ml.cotar.mock.calls.some(([entrada]) => entrada.itemId === 'MLB100')).toBe(false);
  });

  it('isola indisponibilidade/erro de propriedade e não reutiliza cotação antiga', async () => {
    const { ml, service } = prepararPublicado();
    ml.anuncio.mockRejectedValueOnce(new Error('Anúncio de outro vendedor'));
    const resultado = await service.cotar('p1');
    expect(resultado.porSku?.['PROD-AZ']).toBeUndefined();
    expect(resultado.porSku?.['PROD-BR']).toBeDefined();
  });

  it('aceita rotação das três dimensões mantendo peso exato', async () => {
    const { ml, service } = prepararPublicado();
    const original = ml.anuncio.getMockImplementation()!;
    ml.anuncio.mockImplementation(async (itemId) => ({
      ...(await original(itemId)),
      alturaCm: contexto.comprimentoCm,
      comprimentoCm: contexto.alturaCm,
    }));
    expect((await service.cotar('p1')).porSku?.['PROD-AZ']).toBeDefined();
  });

  it('recusa gravação quando a configuração ou uma variação muda durante a consulta', async () => {
    const { mock, service } = prepararPublicado();
    mock.produto.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.cotar('p1')).rejects.toThrow('mudaram durante a consulta');
  });
});

describe('ProdutoMercadoLivreService', () => {
  function preparar() {
    const { mock } = makePrismaMock();
    mock.produto.findUnique.mockResolvedValue(produto);
    mock.produto.updateMany.mockResolvedValue({ count: 1 });
    const ml = { cotar: vi.fn().mockResolvedValue(cotacao) };
    return {
      mock,
      ml,
      service: new ProdutoMercadoLivreService(asPrisma(mock), ml as unknown as MercadoLivreService),
    };
  }

  it('salva a cotação com guarda atômica para preço e condições atuais', async () => {
    const { mock, ml, service } = preparar();
    expect(await service.cotar('p1')).toEqual(cotacao);
    expect(ml.cotar).toHaveBeenCalledWith(contexto);
    expect(mock.produto.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', precoCentavos: 2490, mercadoLivre: { equals: contexto } },
      data: { cotacaoMl: cotacao },
    });
  });

  it('recusa salvar se o preço mudou enquanto aguardava o ML', async () => {
    const { mock, service } = preparar();
    mock.produto.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.cotar('p1')).rejects.toThrow('mudaram durante a consulta');
  });

  it('não chama ML sem medidas reais de envio', async () => {
    const { mock, ml, service } = preparar();
    mock.produto.findUnique.mockResolvedValue({
      ...produto,
      mercadoLivre: { ...contexto, alturaCm: null },
    });
    await expect(service.cotar('p1')).rejects.toThrow('medidas reais do pacote');
    expect(ml.cotar).not.toHaveBeenCalled();
  });
});
