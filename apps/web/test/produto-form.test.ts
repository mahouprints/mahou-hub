import { describe, expect, it } from 'vitest';
import {
  converterProdutoForm,
  insumosDoFormulario,
  PRODUTO_FORM_VAZIO,
  type FormState,
  type ProdutoComInsumos,
} from '../lib/produto-form';

const preenchido: FormState = {
  ...PRODUTO_FORM_VAZIO,
  nome: 'Tampa avulsa',
  filamentoId: 'pla',
  pesoG: '50,5',
  tempoH: '1,25',
  precoReais: '39,90',
  insumos: [{ insumoId: 'acrilico', qtdStr: '0,125' }],
};

describe('cadastro manual de produto', () => {
  it('cadastra peça sem origem MakerWorld e preserva consumo fracionário por unidade', () => {
    expect(converterProdutoForm(preenchido)).toMatchObject({
      nome: 'Tampa avulsa',
      inspiracao: null,
      modelo3dUrl: null,
      pesoG: 50.5,
      tempoH: 1.25,
      precoCentavos: 3990,
      embalagemCentavos: 0,
      ativo: true,
      anunciado: false,
      insumos: [{ insumoId: 'acrilico', qtd: 0.125 }],
    });
  });

  it.each(['', '0', '-1', 'inválido'])('não perde insumo com quantidade inválida %s', (qtdStr) => {
    expect(() =>
      converterProdutoForm({ ...preenchido, insumos: [{ insumoId: 'acrilico', qtdStr }] }),
    ).toThrow('Insumo 1');
  });

  it('exige selecionar um insumo ao informar quantidade', () => {
    expect(() =>
      converterProdutoForm({ ...preenchido, insumos: [{ insumoId: '', qtdStr: '1' }] }),
    ).toThrow('Insumo 1');
  });

  it.each([
    ['nome', '  ', 'nome'],
    ['filamentoId', '', 'filamento'],
    ['pesoG', '0', 'peso'],
    ['tempoH', '-1', 'tempo'],
    ['precoReais', '', 'preço'],
    ['embalagemReais', 'inválido', 'embalagem'],
    ['modelo3dUrl', 'arquivo-local', 'URL'],
    ['larguraCm', '-1', 'largura'],
  ])('impede envio inválido no campo %s', (campo, valor, mensagem) => {
    expect(() => converterProdutoForm({ ...preenchido, [campo]: valor })).toThrow(mensagem);
  });

  it('editar um arquivado não o restaura implicitamente nem altera anúncio', () => {
    const salvo = {
      ...converterProdutoForm(preenchido),
      id: 'tampa',
      ativo: false,
      anunciado: true,
    } as ProdutoComInsumos;
    expect(converterProdutoForm(preenchido, salvo)).toMatchObject({
      ativo: false,
      anunciado: true,
    });
  });
});

describe('conclusão de rascunho e insumos associados', () => {
  it('ativa o rascunho ao completar os campos obrigatórios', () => {
    const rascunho = {
      ...converterProdutoForm(preenchido),
      id: 'rascunho',
      ativo: false,
      rascunho: true,
    } as ProdutoComInsumos;
    expect(converterProdutoForm(preenchido, rascunho).ativo).toBe(true);
  });

  it('mantém disponível o acrílico associado que saiu da lista de insumos ativos', () => {
    const acrilico = {
      id: 'acrilico',
      nome: 'Acrílico',
      unidade: 'un',
      custoUnitarioCentavos: 300,
    };
    const produto = {
      ...converterProdutoForm(preenchido),
      id: 'tampa',
      insumos: [{ insumoId: 'acrilico', qtd: 1, insumo: acrilico }],
    } as ProdutoComInsumos;
    expect(insumosDoFormulario([], produto)).toEqual([acrilico]);
    expect(insumosDoFormulario([{ ...acrilico, custoUnitarioCentavos: 400 }], produto)).toEqual([
      { ...acrilico, custoUnitarioCentavos: 400 },
    ]);
  });
});
