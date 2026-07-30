import { describe, expect, it } from 'vitest';
import { SKU_MAX } from '@mahou-hub/contracts';
import { gerarSku, validarSku } from '../src/modules/variacoes/gerar-sku';

describe('gerarSku', () => {
  it('monta o código a partir do nome do produto e da sigla da cor', () => {
    expect(gerarSku('Suporte de Móbile de Berço', 'AZ')).toBe('SUPORTE-MOBILE-BERCO-AZ');
  });

  it('descarta as palavras que não distinguem nada', () => {
    // "de" e "da" só gastariam caractere que falta pro nome do produto.
    expect(gerarSku('Cubo de Memória', 'VM')).toBe('CUBO-MEMORIA-VM');
  });

  it('tira acento e pontuação', () => {
    expect(gerarSku('Vaso Orgânico (P)', 'BR')).toBe('VASO-ORGANICO-P-BR');
  });

  it('encurta as palavras quando o nome não cabe, em vez de cortar o fim do código', () => {
    // Cortar o fim faria "Cortador de Biscoito Patrulha" e "...Paw" virarem o mesmo SKU.
    const sku = gerarSku('Cortador de biscoito Patrulha Canina', 'VD');
    expect(sku.length).toBeLessThanOrEqual(SKU_MAX);
    expect(sku.endsWith('-VD')).toBe(true);
    expect(sku.split('-').length).toBe(5);
  });

  it('nunca passa do limite, mesmo com nome absurdo', () => {
    const sku = gerarSku(
      'Organizador Modular Multiuso para Bancada de Trabalho com Divisórias Ajustáveis',
      'PT',
    );
    expect(sku.length).toBeLessThanOrEqual(SKU_MAX);
    expect(validarSku(sku)).toBeNull();
  });

  it('produtos parecidos geram códigos diferentes', () => {
    const a = gerarSku('Cubo de memoria + 5 pins 10 fotos', 'AZ');
    const b = gerarSku('Cubo de memoria + 5 pins 18 fotos', 'AZ');
    expect(a).not.toBe(b);
  });

  it('funciona sem cor (produto sem variação de filamento)', () => {
    expect(gerarSku('Abajur Nuvem')).toBe('ABAJUR-NUVEM');
  });

  it('gera código válido para todo nome que passa por ele', () => {
    const nomes = ['Abajur Nuvem', 'Chibieren', 'Brinco Tanjiro', 'Cesta decorativa', 'A'];
    for (const nome of nomes) {
      expect(validarSku(gerarSku(nome, 'RS'))).toBeNull();
    }
  });
});

describe('validarSku', () => {
  it('aceita o formato dos marketplaces', () => {
    expect(validarSku('SUPORTE-MOBILE-AZ')).toBeNull();
    expect(validarSku('MAH0042')).toBeNull();
  });

  it('recusa minúscula, espaço e acento — o que a Shopee e o ML transformariam', () => {
    expect(validarSku('suporte-azul')).toContain('maiúsculas');
    expect(validarSku('SUPORTE AZUL')).toContain('maiúsculas');
    expect(validarSku('SUPORTE-AZÚL')).toContain('maiúsculas');
  });

  it('recusa hífen solto nas pontas ou duplicado', () => {
    expect(validarSku('-SUPORTE')).not.toBeNull();
    expect(validarSku('SUPORTE--AZ')).not.toBeNull();
    expect(validarSku('SUPORTE-')).not.toBeNull();
  });

  it('recusa código maior que o limite', () => {
    expect(validarSku('A'.repeat(SKU_MAX + 1))).toContain('limite');
  });
});
