import { describe, expect, it } from 'vitest';
import {
  detectarNotaDuplicada,
  type ReciboComparavel,
} from '../src/modules/recibos/detectar-nota-duplicada';

const CHAVE = '35260712345678000190550010001404991123456789';
const CHAVE_44 = `${CHAVE}0`;

function recibo(over: Partial<ReciboComparavel> = {}): ReciboComparavel {
  return {
    id: 'r-antigo',
    status: 'CONFIRMADO',
    chaveNfe: null,
    numeroNota: null,
    cnpjEmitente: null,
    fornecedor: 'VOOLT 3D',
    valorCentavos: 38140,
    data: new Date('2026-07-20T12:00:00Z'),
    ...over,
  };
}

describe('detectarNotaDuplicada', () => {
  it('chave da NF-e igual é duplicata forte', () => {
    const d = detectarNotaDuplicada(recibo({ chaveNfe: CHAVE_44 }), [
      recibo({ id: 'r1', chaveNfe: CHAVE_44 }),
    ]);
    expect(d).toEqual({ reciboId: 'r1', nivel: 'FORTE', jaLancado: true });
  });

  it('ignora formatação da chave (espaços e pontos)', () => {
    const formatada = CHAVE_44.replace(/(.{4})/g, '$1 ');
    const d = detectarNotaDuplicada(recibo({ chaveNfe: formatada }), [
      recibo({ id: 'r1', chaveNfe: CHAVE_44 }),
    ]);
    expect(d?.nivel).toBe('FORTE');
  });

  it('número + CNPJ iguais é forte, mesmo sem chave', () => {
    const base = { numeroNota: '140499', cnpjEmitente: '12345678000190' };
    const d = detectarNotaDuplicada(recibo(base), [recibo({ id: 'r1', ...base })]);
    expect(d?.nivel).toBe('FORTE');
  });

  it('zero à esquerda no número não engana', () => {
    const d = detectarNotaDuplicada(
      recibo({ numeroNota: '000140499', cnpjEmitente: '12345678000190' }),
      [recibo({ id: 'r1', numeroNota: '140499', cnpjEmitente: '12345678000190' })],
    );
    expect(d?.nivel).toBe('FORTE');
  });

  it('mesmo número em fornecedores diferentes NÃO é duplicata', () => {
    // Cada emitente numera as próprias notas do zero — nota 1 da Voolt e nota 1 de
    // outro fornecedor não têm relação nenhuma.
    const d = detectarNotaDuplicada(
      recibo({ numeroNota: '140499', cnpjEmitente: '11111111000111', fornecedor: 'OUTRA' }),
      [recibo({ id: 'r1', numeroNota: '140499', cnpjEmitente: '99999999000199' })],
    );
    expect(d).toBeNull();
  });

  it('fornecedor + data + valor iguais é só suspeita fraca', () => {
    const d = detectarNotaDuplicada(recibo(), [recibo({ id: 'r1' })]);
    expect(d).toEqual({ reciboId: 'r1', nivel: 'FRACA', jaLancado: true });
  });

  it('mesmo fornecedor e dia com valor diferente não acusa nada', () => {
    const d = detectarNotaDuplicada(recibo({ valorCentavos: 9900 }), [recibo({ id: 'r1' })]);
    expect(d).toBeNull();
  });

  it('marca jaLancado=false quando o recibo gêmeo ainda não foi confirmado', () => {
    const d = detectarNotaDuplicada(recibo({ chaveNfe: CHAVE_44 }), [
      recibo({ id: 'r1', chaveNfe: CHAVE_44, status: 'EXTRAIDO' }),
    ]);
    expect(d).toEqual({ reciboId: 'r1', nivel: 'FORTE', jaLancado: false });
  });

  it('entre vários candidatos, devolve o pior caso (forte e já lançado)', () => {
    const d = detectarNotaDuplicada(recibo({ chaveNfe: CHAVE_44 }), [
      recibo({ id: 'so-parecido', chaveNfe: null }),
      recibo({ id: 'forte-nao-lancado', chaveNfe: CHAVE_44, status: 'EXTRAIDO' }),
      recibo({ id: 'forte-lancado', chaveNfe: CHAVE_44, status: 'CONFIRMADO' }),
    ]);
    expect(d?.reciboId).toBe('forte-lancado');
  });

  it('nota sem nenhuma identidade não vira duplicata por acidente', () => {
    const d = detectarNotaDuplicada(
      recibo({ fornecedor: null, valorCentavos: null }),
      [recibo({ id: 'r1', fornecedor: null, valorCentavos: null })],
    );
    expect(d).toBeNull();
  });

  it('lista vazia devolve null', () => {
    expect(detectarNotaDuplicada(recibo({ chaveNfe: CHAVE_44 }), [])).toBeNull();
  });
});
