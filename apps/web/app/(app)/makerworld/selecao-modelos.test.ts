import { describe, expect, it } from 'vitest';
import { selecaoDoLote } from './selecao-modelos';

describe('seleção após importar modelos MakerWorld', () => {
  it('abre máquina de sorteio mesmo quando o lote também tem a tag antiga de peso', () => {
    expect(
      selecaoDoLote([
        { tags: ['maquina-coloridos', 'flexi-60g'] },
        { tags: ['maquina-coloridos', 'flexi-60g'] },
      ]),
    ).toBe('maquina-coloridos');
  });

  it('mantém o filtro de flexis leves nos lotes antigos', () => {
    expect(selecaoDoLote([{ tags: ['flexi-60g'] }, { tags: ['flexi-60g'] }])).toBe('flexi-60g');
  });

  it('não esconde parte de um lote misto atrás de uma tag que só um modelo possui', () => {
    expect(selecaoDoLote([{ tags: ['maquina-coloridos'] }, { tags: ['flexi-60g'] }])).toBe('');
    expect(selecaoDoLote([{ tags: [] }, { tags: ['maquina-coloridos'] }])).toBe('');
  });

  it('não assume uma seleção para lote vazio', () => {
    expect(selecaoDoLote([])).toBe('');
  });
});
