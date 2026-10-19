import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { custosMlDaCotacao, type MercadoLivreCotacao } from '@mahou-hub/contracts';
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
