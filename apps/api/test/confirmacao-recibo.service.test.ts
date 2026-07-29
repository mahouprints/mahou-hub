import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ConfirmacaoReciboService } from '../src/modules/recibos/confirmacao-recibo.service';
import type { EstoqueService } from '../src/modules/estoque/estoque.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

function montar(
  itens: Array<Record<string, unknown>>,
  status = 'EXTRAIDO',
  outrosRecibos: Array<Record<string, unknown>> = [],
  identidadeDaNota: Record<string, unknown> = {},
) {
  const { mock } = makePrismaMock();
  const recibo = {
    id: 'r1',
    data: new Date('2026-07-20'),
    fornecedor: 'VOOLT',
    status,
    chaveNfe: null,
    numeroNota: null,
    cnpjEmitente: null,
    valorCentavos: 38140,
    ...identidadeDaNota,
    itens: itens.map((i, idx) => ({
      id: `i${idx}`,
      descricaoNota: 'item',
      quantidade: null,
      unidade: null,
      valorUnitCentavos: null,
      valorTotalCentavos: null,
      tipo: null,
      categoriaCusto: null,
      filamentoId: null,
      insumoId: null,
      gramasTotal: null,
      camposIlegiveis: [],
      movimentoRegistrado: false,
      ...i,
    })),
  };
  mock.recibo.findUnique.mockResolvedValue(recibo);
  mock.recibo.findUniqueOrThrow.mockResolvedValue(recibo);
  mock.recibo.findMany.mockResolvedValue(outrosRecibos);
  const estoque = { registrarMovimento: vi.fn() };
  const svc = new ConfirmacaoReciboService(
    asPrisma(mock),
    estoque as unknown as EstoqueService,
  );
  return { svc, mock, estoque };
}

describe('ConfirmacaoReciboService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filamento entra no estoque em gramas e NÃO vira Custo', async () => {
    // A regra que sustenta o resto: lançar a compra do rolo como Custo faria o financeiro
    // descontar o mesmo dinheiro duas vezes (aqui e no consumo por venda).
    const { svc, mock, estoque } = montar([
      {
        descricaoNota: 'FILAMENTO PLA AZUL 1KG',
        tipo: 'FILAMENTO',
        filamentoId: 'f1',
        gramasTotal: 2000,
        valorUnitCentavos: 11500,
        valorTotalCentavos: 23000,
      },
    ]);

    await svc.confirmar('r1');

    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoItem: 'FILAMENTO',
        filamentoId: 'f1',
        quantidade: 2000,
        motivo: 'COMPRA',
      }),
    );
    expect(mock.custo.create).not.toHaveBeenCalled();
  });

  it('não-estocável vira Custo e NÃO toca no estoque', async () => {
    const { svc, mock, estoque } = montar([
      {
        descricaoNota: 'FRETE',
        tipo: 'NAO_ESTOCAVEL',
        categoriaCusto: 'OUTROS',
        valorTotalCentavos: 4500,
      },
    ]);

    await svc.confirmar('r1');

    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
    expect(mock.custo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          descricao: 'FRETE',
          categoria: 'OUTROS',
          valorCentavos: 4500,
        }),
      }),
    );
  });

  it('insumo entra na unidade do próprio cadastro', async () => {
    const { svc, estoque } = montar([
      { descricaoNota: 'CAIXA', tipo: 'INSUMO', insumoId: 'in1', quantidade: 50 },
    ]);

    await svc.confirmar('r1');

    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({ tipoItem: 'INSUMO', insumoId: 'in1', quantidade: 50 }),
    );
  });

  it('recusa confirmar item sem classificação, dizendo qual item é', async () => {
    const { svc, estoque } = montar([{ descricaoNota: 'PARAFUSO M3', tipo: null }]);

    await expect(svc.confirmar('r1')).rejects.toBeInstanceOf(BadRequestException);
    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
  });

  it('recusa filamento sem peso em gramas em vez de assumir 1kg', async () => {
    const { svc, estoque } = montar([
      { descricaoNota: 'PLA AZUL', tipo: 'FILAMENTO', filamentoId: 'f1', gramasTotal: null },
    ]);

    await expect(svc.confirmar('r1')).rejects.toThrow(/peso total em gramas/);
    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
  });

  it('não relança item que já virou movimento (reconfirmar não duplica saldo)', async () => {
    const { svc, estoque } = montar([
      {
        descricaoNota: 'PLA AZUL',
        tipo: 'FILAMENTO',
        filamentoId: 'f1',
        gramasTotal: 1000,
        movimentoRegistrado: true,
      },
    ]);

    await svc.confirmar('r1');

    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
  });

  it('recusa lançar nota cuja chave já entrou em outro recibo confirmado', async () => {
    const CHAVE = '3'.repeat(44);
    const { svc, estoque } = montar(
      [{ descricaoNota: 'PLA', tipo: 'FILAMENTO', filamentoId: 'f1', gramasTotal: 1000 }],
      'EXTRAIDO',
      [
        {
          id: 'r-anterior',
          status: 'CONFIRMADO',
          chaveNfe: CHAVE,
          numeroNota: null,
          cnpjEmitente: null,
          fornecedor: 'VOOLT',
          valorCentavos: 38140,
          data: new Date('2026-07-20'),
        },
      ],
      { chaveNfe: CHAVE },
    );

    await expect(svc.confirmar('r1')).rejects.toThrow(/já foi lançada/);
    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
  });

  it('deixa passar quando a semelhança é só fornecedor+data+valor', async () => {
    // Duas compras iguais no mesmo dia acontecem. Bloquear aqui travaria compra legítima.
    const { svc, estoque } = montar(
      [{ descricaoNota: 'PLA', tipo: 'FILAMENTO', filamentoId: 'f1', gramasTotal: 1000 }],
      'EXTRAIDO',
      [
        {
          id: 'r-parecido',
          status: 'CONFIRMADO',
          chaveNfe: null,
          numeroNota: null,
          cnpjEmitente: null,
          fornecedor: 'VOOLT',
          valorCentavos: 38140,
          data: new Date('2026-07-20'),
        },
      ],
    );

    await svc.confirmar('r1');

    expect(estoque.registrarMovimento).toHaveBeenCalledTimes(1);
  });

  it('não bloqueia se a nota gêmea existe mas ainda não lançou estoque', async () => {
    const CHAVE = '7'.repeat(44);
    const { svc, estoque } = montar(
      [{ descricaoNota: 'PLA', tipo: 'FILAMENTO', filamentoId: 'f1', gramasTotal: 1000 }],
      'EXTRAIDO',
      [
        {
          id: 'r-rascunho',
          status: 'EXTRAIDO',
          chaveNfe: CHAVE,
          numeroNota: null,
          cnpjEmitente: null,
          fornecedor: 'VOOLT',
          valorCentavos: 38140,
          data: new Date('2026-07-20'),
        },
      ],
      { chaveNfe: CHAVE },
    );

    await svc.confirmar('r1');

    expect(estoque.registrarMovimento).toHaveBeenCalledTimes(1);
  });

  it('vincula o movimento ao recibo de origem pro histórico do estoque', async () => {
    const { svc, estoque } = montar([
      { descricaoNota: 'PLA', tipo: 'FILAMENTO', filamentoId: 'f1', gramasTotal: 1000 },
    ]);

    await svc.confirmar('r1');

    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({
        reciboId: 'r1',
        observacao: expect.stringContaining('Nota de compra'),
      }),
    );
  });

  it('recibo já confirmado não lança nada de novo', async () => {
    const { svc, estoque, mock } = montar(
      [{ descricaoNota: 'PLA', tipo: 'FILAMENTO', filamentoId: 'f1', gramasTotal: 1000 }],
      'CONFIRMADO',
    );

    await svc.confirmar('r1');

    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
    expect(mock.recibo.update).not.toHaveBeenCalled();
  });
});
