import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ExtracaoReciboService } from '../src/modules/recibos/extracao-recibo.service';
import type { GeminiClient } from '../src/modules/recibos/gemini.client';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

vi.mock('fs', () => ({
  promises: { readFile: vi.fn().mockResolvedValue(Buffer.from('nota')), mkdir: vi.fn() },
}));

const config = { get: () => './storage' } as unknown as ConfigService;

/** Monta o serviço com a resposta que o Gemini teria devolvido pra aquela nota. */
function montar(respostaDaIa: unknown, filamentos: Array<{ id: string; nome: string }> = []) {
  const { mock, tx } = makePrismaMock();
  mock.recibo.findUnique.mockResolvedValue({
    id: 'r1',
    status: 'PENDENTE',
    arquivos: [{ arquivo: 'recibos/r1/nf.jpg', mimeType: 'image/jpeg', nomeOriginal: 'nf.jpg' }],
  });
  mock.filamento.findMany.mockResolvedValue(filamentos);
  mock.insumo.findMany.mockResolvedValue([]);
  // Sem outros recibos no banco não há duplicata possível — quem testa isso é
  // detectar-nota-duplicada.test.ts, com a função pura.
  mock.recibo.findMany.mockResolvedValue([]);
  tx.recibo.findUniqueOrThrow.mockResolvedValue({ id: 'r1', itens: [], arquivos: [] });

  const gemini = { lerJson: vi.fn().mockResolvedValue(respostaDaIa) };
  const svc = new ExtracaoReciboService(
    asPrisma(mock),
    gemini as unknown as GeminiClient,
    config,
  );
  return { svc, mock, tx, gemini };
}

/** O que foi gravado como itens do recibo na chamada de update. */
function itensGravados(tx: ReturnType<typeof makePrismaMock>['tx']) {
  const chamada = tx.recibo.update.mock.calls[0]?.[0] as {
    data: { itens: { create: Array<Record<string, unknown>> } };
  };
  return chamada.data.itens.create;
}

describe('ExtracaoReciboService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('guarda null e o alerta quando a IA não leu o valor — não inventa número', async () => {
    const { svc, tx } = montar({
      fornecedor: 'VOOLT',
      data: '2026-07-20',
      valorTotal: null,
      camposIlegiveis: ['valorTotal'],
      itens: [
        {
          descricaoNota: 'FILAMENTO PLA AZUL',
          quantidade: 2,
          unidade: 'un',
          valorUnitario: null,
          valorTotal: null,
          tipo: 'FILAMENTO',
          gramasTotal: null,
          camposIlegiveis: ['valorUnitario', 'gramasTotal'],
        },
      ],
    });

    await svc.extrair('r1');

    const gravado = tx.recibo.update.mock.calls[0]?.[0] as {
      data: { valorCentavos: number | null; camposIlegiveis: string[] };
    };
    expect(gravado.data.valorCentavos).toBeNull();
    expect(gravado.data.camposIlegiveis).toContain('valorTotal');
    expect(itensGravados(tx)[0]?.valorTotalCentavos).toBeNull();
    expect(itensGravados(tx)[0]?.camposIlegiveis).toEqual(
      expect.arrayContaining(['valorUnitario', 'gramasTotal']),
    );
  });

  it('lista como ilegível o campo que voltou nulo, mesmo se a IA não avisar', async () => {
    // Regressão: numa nota rasurada de verdade (29/07/2026) o Gemini devolveu fornecedor,
    // data e valor todos null e ainda assim mandou camposIlegiveis vazio. A tela usa essa
    // lista pra pedir outra foto — vazia por engano, o buraco passava batido.
    const { svc, tx } = montar({
      fornecedor: null,
      data: null,
      valorTotal: null,
      camposIlegiveis: [],
      itens: [
        {
          descricaoNota: '#### ####',
          quantidade: null,
          unidade: null,
          valorUnitario: null,
          valorTotal: null,
          tipo: null,
          camposIlegiveis: [],
        },
      ],
    });

    await svc.extrair('r1');

    const gravado = tx.recibo.update.mock.calls[0]?.[0] as { data: { camposIlegiveis: string[] } };
    expect(gravado.data.camposIlegiveis).toEqual(
      expect.arrayContaining(['fornecedor', 'data', 'valorTotal']),
    );
    expect(itensGravados(tx)[0]?.camposIlegiveis).toEqual(
      expect.arrayContaining(['quantidade', 'unidade', 'tipo', 'valorTotal']),
    );
  });

  it('não inventa alerta pra valor unitário que dá pra derivar do total', async () => {
    const { svc, tx } = montar({
      camposIlegiveis: [],
      itens: [
        {
          descricaoNota: 'CAIXA',
          quantidade: 10,
          unidade: 'un',
          valorUnitario: null,
          valorTotal: 25,
          tipo: 'INSUMO',
          camposIlegiveis: [],
        },
      ],
    });

    await svc.extrair('r1');

    expect(itensGravados(tx)[0]?.valorUnitCentavos).toBe(250);
    expect(itensGravados(tx)[0]?.camposIlegiveis).toEqual([]);
  });

  it('converte reais em centavos sem erro de ponto flutuante', async () => {
    const { svc, tx } = montar({
      fornecedor: null,
      data: null,
      valorTotal: 115.5,
      camposIlegiveis: [],
      itens: [],
    });

    await svc.extrair('r1');

    const gravado = tx.recibo.update.mock.calls[0]?.[0] as { data: { valorCentavos: number } };
    expect(gravado.data.valorCentavos).toBe(11550);
  });

  it('calcula o total da linha a partir do unitário — a conta que a IA não faz', async () => {
    const { svc, tx } = montar({
      camposIlegiveis: [],
      itens: [
        {
          descricaoNota: 'CAIXA 20X20',
          quantidade: 50,
          unidade: 'un',
          valorUnitario: 1.35,
          valorTotal: null,
          tipo: 'INSUMO',
          camposIlegiveis: [],
        },
      ],
    });

    await svc.extrair('r1');

    expect(itensGravados(tx)[0]?.valorUnitCentavos).toBe(135);
    expect(itensGravados(tx)[0]?.valorTotalCentavos).toBe(6750);
  });

  it('vincula o item ao filamento cadastrado quando o nome bate', async () => {
    const { svc, tx } = montar(
      {
        camposIlegiveis: [],
        itens: [
          {
            descricaoNota: 'FILAMENTO PLA 1KG AZUL VOOLT',
            quantidade: 1,
            unidade: 'un',
            tipo: 'FILAMENTO',
            gramasTotal: 1000,
            camposIlegiveis: [],
          },
        ],
      },
      [{ id: 'f-azul', nome: 'PLA Azul Voolt' }],
    );

    await svc.extrair('r1');

    expect(itensGravados(tx)[0]?.filamentoId).toBe('f-azul');
  });

  it('deixa o vínculo nulo quando não existe filamento correspondente', async () => {
    const { svc, tx } = montar(
      {
        camposIlegiveis: [],
        itens: [
          {
            descricaoNota: 'FILAMENTO PETG VERDE NEON',
            quantidade: 1,
            unidade: 'un',
            tipo: 'FILAMENTO',
            camposIlegiveis: [],
          },
        ],
      },
      [{ id: 'f-azul', nome: 'PLA Azul Voolt' }],
    );

    await svc.extrair('r1');

    expect(itensGravados(tx)[0]?.filamentoId).toBeNull();
  });

  it('rejeita resposta fora do formato em vez de gravar lixo', async () => {
    const { svc } = montar({ itens: [{ quantidade: 2 }], camposIlegiveis: [] });

    await expect(svc.extrair('r1')).rejects.toThrow();
  });

  it('não relê recibo já confirmado', async () => {
    const { svc, mock, gemini } = montar({ camposIlegiveis: [], itens: [] });
    mock.recibo.findUnique.mockResolvedValue({ id: 'r1', status: 'CONFIRMADO', arquivos: [] });

    await expect(svc.extrair('r1')).rejects.toThrow(/já confirmado/);
    expect(gemini.lerJson).not.toHaveBeenCalled();
  });
});
