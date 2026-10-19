import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalcularOutput, ProdutoVariacaoComPricing } from '@mahou-hub/contracts';
import { VariacoesSection } from '../components/variacoes-section';

const consulta = vi.hoisted(() => ({ variacoes: [] as ProdutoVariacaoComPricing[] }));
vi.stubGlobal('React', React);
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: consulta.variacoes }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/format', () => import('../lib/format'));
vi.mock('@/components/ui/badge', () => ({ Badge: () => null }));
vi.mock('@/components/ui/button', () => ({ Button: () => null }));
vi.mock('@/components/movimento-dialog', () => ({ MovimentoDialog: () => null }));
vi.mock('@/components/variacao-dialog', () => ({ VariacaoDialog: () => null }));
vi.mock('@/components/ui/table', () => {
  const tags = {
    Table: 'table',
    TableBody: 'tbody',
    TableCell: 'td',
    TableHead: 'th',
    TableHeader: 'thead',
    TableRow: 'tr',
  };
  return Object.fromEntries(
    Object.entries(tags).map(([nome, tag]) => [
      nome,
      (props: { children?: React.ReactNode }) => React.createElement(tag, props),
    ]),
  );
});

const pricing: CalcularOutput = {
  custoFilamentoCentavos: 87,
  custoEnergiaCentavos: 7,
  custoTotalProducaoCentavos: 134,
  impostoCentavos: 137,
  taxaShopeeCentavos: 858,
  taxaMlCentavos: 263,
  freteMlCentavos: 1295,
  custosMlStatus: 'COTADO',
  taxaTikTokCentavos: 1031,
  liquidoShopeeCentavos: 1161,
  liquidoMlCentavos: 461,
  liquidoSiteCentavos: 2019,
  liquidoTikTokCentavos: 988,
  margemShopee: 0.507,
  margemMl: 0.201,
  margemSite: 0.882,
  margemTikTok: 0.431,
  lucroPorHoraShopeeCentavos: 1334,
  lucroPorHoraMlCentavos: 530,
  lucroPorHoraSiteCentavos: 2321,
  lucroPorHoraTikTokCentavos: 1136,
};

const cotacaoMl = {
  contexto: {
    itemId: 'MLB123',
    categoriaId: 'MLB1839',
    tipoAnuncio: 'gold_special' as const,
    modoEnvio: 'me2' as const,
    tipoLogistica: 'xd_drop_off',
    freteGratis: true,
    condicao: 'new' as const,
    precoCentavos: 2290,
    pesoGramas: 23,
    alturaCm: 2,
    larguraCm: 15,
    comprimentoCm: 20,
  },
  categoriaNome: 'Figuras de Ação',
  tarifaCentavos: 263,
  freteCentavos: 1295,
  tarifaFixaCentavos: 0,
  percentualTarifa: 11.5,
  cotadoEm: '2026-10-19T15:00:00.000Z',
  pendencias: [],
};

function variacao(mudancas: Partial<ProdutoVariacaoComPricing> = {}): ProdutoVariacaoComPricing {
  return {
    id: 'branco',
    produtoId: 'dragao',
    nome: 'Branco',
    sku: 'DRAGAO-BR',
    filamentoId: 'pla-br',
    precoCentavos: null,
    pesoG: null,
    tempoH: null,
    estoqueAtual: 0,
    estoqueMinimo: 0,
    ativo: true,
    filamento: { nome: 'PLA Branco' },
    precoEfetivoCentavos: 2290,
    pesoEfetivoG: 13,
    tempoEfetivoH: 0.87,
    pricing,
    pricingPendencias: [],
    cotacaoMl,
    ...mudancas,
  };
}

function renderizar() {
  return renderToStaticMarkup(
    React.createElement(VariacoesSection, {
      produtoId: 'dragao',
      produtoNome: 'Minidragão',
    }),
  ).replace(/\u00a0/g, ' ');
}

beforeEach(() => {
  consulta.variacoes = [];
});

describe('custos por cor na tabela de variações', () => {
  it('mostra o custo e a contribuição próprios de cada filamento', () => {
    consulta.variacoes = [
      variacao(),
      variacao({
        id: 'azul',
        nome: 'Azul',
        sku: 'DRAGAO-AZ',
        filamento: { nome: 'PLA Azul' },
        pricing: {
          ...pricing,
          custoTotalProducaoCentavos: 180,
          liquidoMlCentavos: 415,
          margemMl: 0.181,
        },
      }),
    ];
    const html = renderizar();
    expect(html).toContain('R$ 1,34');
    expect(html).toContain('R$ 1,80');
    expect(html).toContain('R$ 4,61');
    expect(html).toContain('R$ 4,15');
    expect(html).toContain('20,1%');
    expect(html).toContain('18,1%');
  });

  it('não mostra margem quando o preço alterado perdeu a cotação', () => {
    consulta.variacoes = [
      variacao({
        precoCentavos: 2990,
        precoEfetivoCentavos: 2990,
        cotacaoMl: null,
        pricing: {
          ...pricing,
          custosMlStatus: 'PENDENTE',
          taxaMlCentavos: null,
          freteMlCentavos: null,
          liquidoMlCentavos: null,
          margemMl: null,
          lucroPorHoraMlCentavos: null,
        },
      }),
    ];
    const html = renderizar();
    expect(html).toContain('R$ 29,90');
    expect(html).toContain('Cotação pendente');
    expect(html).not.toContain('20,1%');
  });

  it('mostra tarifa, envio e data da cotação de cada cor como estimativas', () => {
    consulta.variacoes = [
      variacao(),
      variacao({
        id: 'azul',
        nome: 'Azul',
        sku: 'DRAGAO-AZ',
        cotacaoMl: {
          ...cotacaoMl,
          contexto: { ...cotacaoMl.contexto, itemId: 'MLB456' },
          tarifaCentavos: 270,
          freteCentavos: 900,
          cotadoEm: '2026-10-19T16:00:00.000Z',
        },
      }),
    ];
    const html = renderizar();
    const branca = html.split('</tr>').find((linha) => linha.includes('DRAGAO-BR'))!;
    const azul = html.split('</tr>').find((linha) => linha.includes('DRAGAO-AZ'))!;
    expect(branca).toContain('Tarifa: R$ 2,63');
    expect(branca).toContain('Envio: R$ 12,95');
    expect(branca).toContain('2026-10-19T15:00:00.000Z');
    expect(azul).toContain('Tarifa: R$ 2,70');
    expect(azul).toContain('Envio: R$ 9,00');
    expect(azul).toContain('2026-10-19T16:00:00.000Z');
    expect(azul).not.toContain('R$ 12,95');
    expect(html).toContain('Tarifa e envio ML estimados');
    expect(html).toContain('Contribuição ML estimada');
  });

  it('distingue frete estimado zero de indisponível e mostra o motivo', () => {
    consulta.variacoes = [
      variacao({ cotacaoMl: { ...cotacaoMl, freteCentavos: 0 } }),
      variacao({
        id: 'azul',
        nome: 'Azul',
        sku: 'DRAGAO-AZ',
        cotacaoMl: {
          ...cotacaoMl,
          freteCentavos: null,
          pendencias: ['Frete indisponível para esta cor.'],
        },
        pricing: {
          ...pricing,
          custosMlStatus: 'PENDENTE',
          freteMlCentavos: null,
          liquidoMlCentavos: null,
          margemMl: null,
        },
      }),
    ];
    const html = renderizar();
    const branca = html.split('</tr>').find((linha) => linha.includes('DRAGAO-BR'))!;
    const azul = html.split('</tr>').find((linha) => linha.includes('DRAGAO-AZ'))!;
    expect(branca).toContain('Envio: R$ 0,00');
    expect(azul).toContain('Envio: pendente');
    expect(azul).toContain('Frete indisponível para esta cor.');
    expect(azul).toContain('Cotação pendente');
    expect(azul).not.toContain('20,1%');
  });

  it('distingue contribuição zero de cotação pendente', () => {
    consulta.variacoes = [
      variacao({
        pricing: { ...pricing, liquidoMlCentavos: 0, margemMl: 0 },
      }),
    ];
    const html = renderizar();
    expect(html).toContain('R$ 0,00');
    expect(html).toContain('0,0%');
    expect(html).not.toContain('Cotação pendente');
  });

  it('mostra a pendência de composição em vez de um custo inventado', () => {
    consulta.variacoes = [
      variacao({ pricing: null, pricingPendencias: ['Revise os filamentos.'] }),
    ];
    const html = renderizar();
    expect(html).toContain('Revisar composição');
    expect(html).toContain('Revise os filamentos.');
    expect(html).not.toContain('R$ 1,34');
  });
});
