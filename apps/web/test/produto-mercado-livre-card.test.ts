import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Produto } from '@mahou-hub/contracts';
import { ProdutoMercadoLivreCard } from '../components/produto-mercado-livre-card';

vi.stubGlobal('React', React);
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/format', () => import('../lib/format'));
vi.mock('next/link', () => ({ default: () => null }));
vi.mock('../components/ui/button', () => ({
  Button: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('button', null, children),
}));
vi.mock('../components/ui/card', () => {
  const card = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return {
    Card: card,
    CardContent: card,
    CardDescription: card,
    CardHeader: card,
    CardTitle: card,
  };
});

type ProdutoCotacao = Pick<Produto, 'id' | 'precoCentavos' | 'mercadoLivre' | 'cotacaoMl'>;
const configuracao = {
  categoriaId: 'MLB1839',
  tipoAnuncio: 'gold_special' as const,
  modoEnvio: 'me2' as const,
  tipoLogistica: 'xd_drop_off',
  freteGratis: true,
  condicao: 'new' as const,
  pesoGramas: 23,
  alturaCm: 2,
  larguraCm: 15,
  comprimentoCm: 20,
};
const produto: ProdutoCotacao = {
  id: 'dragao',
  precoCentavos: 2290,
  mercadoLivre: configuracao,
  cotacaoMl: {
    contexto: { ...configuracao, precoCentavos: 2290 },
    categoriaNome: 'Figuras de Ação',
    tarifaCentavos: 263,
    freteCentavos: 1295,
    tarifaFixaCentavos: 0,
    percentualTarifa: 11.5,
    cotadoEm: '2026-10-19T15:00:00.000Z',
    pendencias: [],
  },
};

function renderizar(produtoCotacao: ProdutoCotacao) {
  return renderToStaticMarkup(
    React.createElement(ProdutoMercadoLivreCard, { produto: produtoCotacao }),
  ).replace(/\u00a0/g, ' ');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-19T16:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

describe('contexto da cotação no card do Mercado Livre', () => {
  it('mostra a simulação geral antes de existirem anúncios por SKU', () => {
    const html = renderizar(produto);
    expect(html).toContain('Tarifa prevista: <strong>R$ 2,63</strong>');
    expect(html).toContain('Envio previsto: <strong>R$ 12,95</strong>');
    expect(html).toContain('Validade de 24 horas');
    expect(html).toContain('Consultar tarifa e envio');
  });

  it('orienta a consulta por cor sem apresentar a simulação geral como universal', () => {
    const html = renderizar({
      ...produto,
      cotacaoMl: {
        ...produto.cotacaoMl!,
        pendencias: ['DRAGAO-BR: vínculo, anúncio ou cotação não confirmado; consulte novamente.'],
      },
      mercadoLivre: {
        ...configuracao,
        publicacao: {
          versao: 1,
          execucaoId: 'publicacao-dragao',
          status: 'concluido',
          atualizadoEm: '2026-10-19T15:00:00.000Z',
          itens: [
            {
              chave: 'branco',
              itemId: 'MLB123',
              skus: ['DRAGAO-BR'],
              descricaoConfirmada: true,
              fiscalConfirmado: true,
              verificado: true,
            },
          ],
        },
      },
    });
    expect(html).toContain('Mercado Livre: custos previstos por cor');
    expect(html).toContain('cada SKU publicado');
    expect(html).toContain('data da consulta de cada cor na tabela de variações');
    expect(html).toContain('Consultar tarifas e envios por cor');
    expect(html).toContain('Os custos efetivos ficam nos pedidos e no financeiro');
    expect(html).toContain('DRAGAO-BR: vínculo, anúncio ou cotação não confirmado');
    expect(html).not.toContain('Consulta:');
    expect(html).not.toContain('R$ 2,63');
    expect(html).not.toContain('R$ 12,95');
    expect(html).not.toContain('Margem do Mercado Livre pendente');
  });
});
