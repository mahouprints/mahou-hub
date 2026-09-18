import { describe, expect, it } from 'vitest';
import { converterProdutoForm, PRODUTO_FORM_VAZIO } from '../lib/produto-form';
import {
  converterFilamentosForm,
  custoFilamentosFormulario,
  filamentosDoFormulario,
  linhasFilamentosDoProduto,
  pesoTotalFilamentos,
  type FilamentoLinha,
} from '../lib/produto-filamentos';

const cincoCores: FilamentoLinha[] = [
  { filamentoId: 'branco', pesoGStr: '10,25' },
  { filamentoId: 'verde', pesoGStr: '3,10' },
  { filamentoId: 'azul', pesoGStr: '0,20' },
  { filamentoId: 'vermelho', pesoGStr: '5,50' },
  { filamentoId: 'preto', pesoGStr: '0,95' },
];
const custosKg = [8000, 9500, 10000, 7500, 8500];
const filamentos = cincoCores.map((linha, indice) => ({
  id: linha.filamentoId,
  nome: linha.filamentoId,
  ativo: true,
  custoKgCentavos: custosKg[indice]!,
}));

function cadastro(linhas: FilamentoLinha[]) {
  return converterProdutoForm({
    ...PRODUTO_FORM_VAZIO,
    nome: 'Plaquinha',
    tempoH: '1,5',
    precoReais: '49,90',
    filamentos: linhas,
  });
}

describe('composição de filamentos por unidade', () => {
  it('salva cinco materiais distintos, conserva pesos e deriva campos legados', () => {
    const produto = cadastro(cincoCores);
    expect(produto.filamentos).toEqual([
      { filamentoId: 'branco', pesoG: 10.25 },
      { filamentoId: 'verde', pesoG: 3.1 },
      { filamentoId: 'azul', pesoG: 0.2 },
      { filamentoId: 'vermelho', pesoG: 5.5 },
      { filamentoId: 'preto', pesoG: 0.95 },
    ]);
    expect(produto.filamentoId).toBe('branco');
    expect(produto.pesoG).toBe(20);
    expect(custoFilamentosFormulario(cincoCores, filamentos)).toBe(163);
  });

  it('abre produto legado como uma única linha e o converte sem mudar peso', () => {
    const linhas = linhasFilamentosDoProduto({ filamentoId: 'branco', pesoG: '50.50' });
    expect(linhas).toEqual([{ filamentoId: 'branco', pesoGStr: '50,50' }]);
    expect(cadastro(linhas)).toMatchObject({
      filamentoId: 'branco',
      pesoG: 50.5,
      filamentos: [{ filamentoId: 'branco', pesoG: 50.5 }],
    });
  });

  it('carrega a composição existente em vez de atribuir o peso total ao primeiro', () => {
    expect(
      linhasFilamentosDoProduto({
        filamentoId: 'branco',
        pesoG: 20,
        filamentos: converterFilamentosForm(cincoCores),
      }),
    ).toEqual([
      { filamentoId: 'branco', pesoGStr: '10,25' },
      { filamentoId: 'verde', pesoGStr: '3,1' },
      { filamentoId: 'azul', pesoGStr: '0,2' },
      { filamentoId: 'vermelho', pesoGStr: '5,5' },
      { filamentoId: 'preto', pesoGStr: '0,95' },
    ]);
  });

  it('remover a primeira linha atualiza peso total e referência de energia', () => {
    const restantes = cincoCores.filter((_, indice) => indice !== 0);
    const produto = cadastro(restantes);
    expect(produto.filamentoId).toBe('verde');
    expect(produto.pesoG).toBe(9.75);
    expect(produto.filamentos).toHaveLength(4);
    expect(custoFilamentosFormulario(restantes, filamentos)).toBe(81);
  });

  it('rejeita composição vazia e materiais repetidos, sem descartar linhas', () => {
    expect(() => cadastro([])).toThrow('pelo menos um');
    expect(() => cadastro([cincoCores[0]!, cincoCores[0]!])).toThrow('uma única vez');
    expect(() => cadastro([{ filamentoId: '', pesoGStr: '1' }])).toThrow('Selecione');
  });

  it.each(['', '0', '-1', 'inválido', '0,001'])('rejeita peso inválido %s', (pesoGStr) => {
    expect(() => cadastro([{ filamentoId: 'branco', pesoGStr }])).toThrow();
  });

  it('soma centésimos de grama sem ruído e arredonda dinheiro apenas após somar', () => {
    expect(
      pesoTotalFilamentos([
        { filamentoId: 'a', pesoG: 0.1 },
        { filamentoId: 'b', pesoG: 0.2 },
      ]),
    ).toBe(0.3);
    const pequenos = cincoCores.map((linha) => ({ ...linha, pesoGStr: '0,49' }));
    expect(
      custoFilamentosFormulario(
        pequenos,
        filamentos.map((item) => ({ ...item, custoKgCentavos: 1000 })),
      ),
    ).toBe(2);
  });

  it('mantém subtotal de 0,30 g a R$ 50/kg igual ao cálculo do backend', () => {
    expect(
      custoFilamentosFormulario(
        [{ filamentoId: 'branco', pesoGStr: '0,30' }],
        [{ ...filamentos[0]!, custoKgCentavos: 5000 }],
      ),
    ).toBe(2);
  });

  it('arredonda a soma exata de cinco materiais sem arredondar cada subtotal', () => {
    const pesos = ['0,30', '0,15', '0,12', '0,06', '0,50'];
    const precos = [5000, 10000, 12500, 25000, 3000];
    const linhas = cincoCores.map((linha, indice) => ({ ...linha, pesoGStr: pesos[indice]! }));
    const materiais = filamentos.map((item, indice) => ({
      ...item,
      custoKgCentavos: precos[indice]!,
    }));
    expect(custoFilamentosFormulario(linhas, materiais)).toBe(8);
  });

  it('preserva material inativo associado que não está mais no cadastro disponível', () => {
    const antigo = { ...filamentos[0]!, ativo: false };
    expect(
      filamentosDoFormulario([], {
        filamentoId: antigo.id,
        pesoG: 1,
        filamentos: [{ filamentoId: antigo.id, pesoG: 1, filamento: antigo }],
      }),
    ).toEqual([antigo]);
    expect(
      filamentosDoFormulario([], { filamentoId: antigo.id, pesoG: 1, filamento: antigo }),
    ).toEqual([antigo]);
  });
});
