import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { EstoqueService } from '../src/modules/estoque/estoque.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

// O create do movimento ecoa os dados que o serviço calculou (com Decimals),
// pra exercitar o toDto (Decimal → number) na resposta.
function stubCriarMovimento(tx: ReturnType<typeof makePrismaMock>['tx']) {
  tx.movimentoEstoque.create.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'm1', criadoEm: new Date(), ...args.data }),
  );
}

describe('EstoqueService.registrarMovimento — variação (produto pronto)', () => {
  it('entrada soma no saldo e grava saldoApos', async () => {
    const { mock, tx } = makePrismaMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({ id: 'v1', estoqueAtual: 0 });
    stubCriarMovimento(tx);
    const svc = new EstoqueService(asPrisma(mock));

    const r = await svc.registrarMovimento({
      tipoItem: 'PRODUTO',
      variacaoId: 'v1',
      quantidade: 10,
      motivo: 'ESTOQUE_INICIAL',
    });

    expect(tx.produtoVariacao.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { estoqueAtual: 10 },
    });
    expect(r.saldoApos).toBe(10);
    expect(r.quantidade).toBe(10);
  });

  it('baixa válida subtrai do saldo', async () => {
    const { mock, tx } = makePrismaMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({ id: 'v1', estoqueAtual: 10 });
    stubCriarMovimento(tx);
    const svc = new EstoqueService(asPrisma(mock));

    const r = await svc.registrarMovimento({
      tipoItem: 'PRODUTO',
      variacaoId: 'v1',
      quantidade: -3,
      motivo: 'VENDA',
    });

    expect(tx.produtoVariacao.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { estoqueAtual: 7 },
    });
    expect(r.saldoApos).toBe(7);
  });

  it('baixa que deixaria o saldo negativo é bloqueada e não altera nada', async () => {
    const { mock, tx } = makePrismaMock();
    tx.produtoVariacao.findUnique.mockResolvedValue({ id: 'v1', estoqueAtual: 2 });
    stubCriarMovimento(tx);
    const svc = new EstoqueService(asPrisma(mock));

    await expect(
      svc.registrarMovimento({
        tipoItem: 'PRODUTO',
        variacaoId: 'v1',
        quantidade: -5,
        motivo: 'VENDA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.produtoVariacao.update).not.toHaveBeenCalled();
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
  });
});

describe('EstoqueService.registrarMovimento — filamento (gramas, Decimal)', () => {
  it('baixa de gramas usa aritmética Decimal e grava o novo saldo', async () => {
    const { mock, tx } = makePrismaMock();
    tx.filamento.findUnique.mockResolvedValue({
      id: 'f1',
      estoqueGramas: new Prisma.Decimal(1000),
    });
    stubCriarMovimento(tx);
    const svc = new EstoqueService(asPrisma(mock));

    const r = await svc.registrarMovimento({
      tipoItem: 'FILAMENTO',
      filamentoId: 'f1',
      quantidade: -240,
      motivo: 'PRODUCAO',
    });

    const updateArg = tx.filamento.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { estoqueGramas: Prisma.Decimal };
    };
    expect(updateArg.where).toEqual({ id: 'f1' });
    expect(Number(updateArg.data.estoqueGramas)).toBe(760);
    expect(r.saldoApos).toBe(760);
  });
});

describe('EstoqueService.alertas', () => {
  it('lista item no/abaixo do mínimo configurado (mínimo > 0)', async () => {
    const { mock } = makePrismaMock();
    mock.filamento.findMany.mockResolvedValue([
      {
        id: 'f1',
        nome: 'PETG Rosa',
        estoqueGramas: new Prisma.Decimal(150),
        estoqueMinGramas: new Prisma.Decimal(200),
      },
    ]);
    mock.insumo.findMany.mockResolvedValue([]);
    mock.produtoVariacao.findMany.mockResolvedValue([]);
    const svc = new EstoqueService(asPrisma(mock));

    const alertas = await svc.alertas();

    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      tipo: 'FILAMENTO',
      nome: 'PETG Rosa',
      saldo: 150,
      minimo: 200,
      unidade: 'g',
    });
  });
});
