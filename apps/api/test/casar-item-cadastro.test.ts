import { describe, expect, it } from 'vitest';
import { casarComCadastro } from '../src/modules/recibos/casar-item-cadastro';

const FILAMENTOS = [
  { id: 'f-azul', nome: 'PLA Azul Voolt' },
  { id: 'f-azul-velvet', nome: 'PLA Azul Velvet Voolt' },
  { id: 'f-cinza', nome: 'PLA Cinza Claro Velvet Voolt' },
];

describe('casarComCadastro', () => {
  it('casa ignorando ordem, caixa e ruído da descrição da nota', () => {
    expect(casarComCadastro('FILAMENTO PLA 1KG AZUL VOOLT', FILAMENTOS)).toBe('f-azul');
  });

  it('casa com acento na descrição da nota', () => {
    const insumos = [{ id: 'i1', nome: 'Caixa Papelao 20x20' }];
    expect(casarComCadastro('CAIXA PAPELÃO 20X20 KRAFT', insumos)).toBe('i1');
  });

  it('prefere o cadastro mais específico quando a nota traz as duas palavras', () => {
    expect(casarComCadastro('FILAMENTO PLA AZUL VELVET VOOLT 1KG', FILAMENTOS)).toBe(
      'f-azul-velvet',
    );
  });

  it('não casa quando falta uma palavra do nome cadastrado', () => {
    // "cinza claro velvet" não pode virar "cinza" e qualquer coisa — é rolo diferente.
    expect(casarComCadastro('FILAMENTO PLA CINZA', FILAMENTOS)).toBeNull();
  });

  it('não casa quando nada corresponde', () => {
    expect(casarComCadastro('BICO 0.4MM LATAO', FILAMENTOS)).toBeNull();
  });

  it('devolve null em vez de escolher entre dois cadastros igualmente específicos', () => {
    const ambiguos = [
      { id: 'a', nome: 'Fita Dupla Face' },
      { id: 'b', nome: 'Dupla Face Fita' },
    ];
    expect(casarComCadastro('FITA DUPLA FACE 12MM', ambiguos)).toBeNull();
  });
});
