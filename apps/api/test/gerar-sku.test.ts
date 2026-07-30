import { describe, expect, it } from 'vitest';
import { SKU_MAX } from '@mahou-hub/contracts';
import { gerarSku, siglaDaCor, validarSku } from '../src/modules/variacoes/gerar-sku';

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

  it('prefere menos palavras inteiras a muitas palavras espremidas', () => {
    // "DRA-FLE-ART-IMP-3D" não diz nada; "DRAGAO-FLEXIVEL" diz. Foi o defeito que fez os
    // SKUs do dragão saírem ilegíveis em produção (30/07/2026).
    expect(gerarSku('Cortador de biscoito Patrulha Canina', 'VD')).toBe('CORTADOR-BISCOITO-VD');
  });

  it('poda ruído de título de anúncio', () => {
    // O nome do produto costuma ser a copy inteira da Shopee.
    const sku = gerarSku(
      'Dragao Flexivel Articulado Impressao 3D Brinquedo Antistress Fidget Dino Enfeite Mesa Presente',
      'BR',
    );
    expect(sku).toBe('DRAGAO-FLEXIVEL-BR');
  });

  it('nunca passa do limite, mesmo com nome absurdo', () => {
    const sku = gerarSku(
      'Organizador Modular Multiuso para Bancada de Trabalho com Divisórias Ajustáveis',
      'PT',
    );
    expect(sku.length).toBeLessThanOrEqual(SKU_MAX);
    expect(validarSku(sku)).toBeNull();
  });

  it('nomes que só diferem no FIM colidem — quem desempata é o service', () => {
    // Limite consciente: cortar em 3 palavras perde o "10/18 fotos" que distingue os
    // cubos. O service resolve com sufixo numérico, e esses casos pedem SKU digitado à
    // mão. A alternativa (espremer o nome inteiro) deixava ilegível TODO produto pra
    // salvar três.
    const a = gerarSku('Cubo de memoria + 5 pins 10 fotos', 'AZ');
    const b = gerarSku('Cubo de memoria + 5 pins 18 fotos', 'AZ');
    expect(a).toBe(b);
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

describe('siglaDaCor', () => {
  it('reconhece as cores comuns escritas por extenso', () => {
    expect(siglaDaCor('Branco')).toBe('BR');
    expect(siglaDaCor('Preto')).toBe('PT');
    expect(siglaDaCor('Vermelho')).toBe('VM');
  });

  it('acha a cor no meio do nome do filamento', () => {
    // "PLA Branco OFF White Velvet Voolt" — a cor não está na primeira palavra.
    expect(siglaDaCor('PLA Branco OFF White Velvet Voolt')).toBe('BR');
    expect(siglaDaCor('PETG HF Azul Voolt')).toBe('AZ');
  });

  it('ignora material, acabamento e marca ao deduzir', () => {
    // Sem isso "PLA Rose Gold Voolt" virava PLR, consoantes de PLA+ROSE.
    expect(siglaDaCor('PLA Rose Gold Voolt')).toBe('RSG');
  });

  it('devolve vazio quando não sobra nada além de material', () => {
    expect(siglaDaCor('PLA Voolt')).toBe('');
  });
});
