import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ProducaoService } from '../src/modules/producao/producao.service';
import type { EstoqueService } from '../src/modules/estoque/estoque.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

function makeEstoqueMock() {
  return {
    registrarMovimento: vi.fn().mockResolvedValue({}),
  } as unknown as EstoqueService & { registrarMovimento: ReturnType<typeof vi.fn> };
}

describe('ProducaoService.mudarStatus — baixa automática de filamento', () => {
  it('ao marcar CONCLUIDO, baixa o filamento (peso × qtd) permitindo negativo', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1',
      qtd: 3,
      consumoRegistrado: false,
      dataFim: null,
      produto: { nome: 'Suporte', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
    });
    mock.jobProducao.update.mockResolvedValue({ id: 'j1', status: 'CONCLUIDO' });
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'CONCLUIDO');

    // 120 × 3 = 360g, com sinal negativo (baixa), motivo PRODUCAO, permitindo negativo
    expect(estoque.registrarMovimento).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoItem: 'FILAMENTO',
        filamentoId: 'f1',
        quantidade: -360,
        motivo: 'PRODUCAO',
      }),
      { permitirNegativo: true },
    );
    // marcou consumoRegistrado pra não baixar de novo
    expect(mock.jobProducao.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { consumoRegistrado: true } }),
    );
  });

  it('não baixa de novo quando o consumo já foi registrado', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1',
      qtd: 3,
      consumoRegistrado: true,
      dataFim: new Date(),
      produto: { nome: 'X', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
    });
    mock.jobProducao.update.mockResolvedValue({ id: 'j1', status: 'CONCLUIDO' });
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'CONCLUIDO');

    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
  });

  it('mudar pra IMPRIMINDO não mexe no estoque', async () => {
    const { mock } = makePrismaMock();
    mock.jobProducao.findUnique.mockResolvedValue({
      id: 'j1',
      qtd: 3,
      consumoRegistrado: false,
      dataFim: null,
      produto: { nome: 'X', pesoG: new Prisma.Decimal(120), filamentoId: 'f1' },
    });
    mock.jobProducao.update.mockResolvedValue({ id: 'j1', status: 'IMPRIMINDO' });
    const estoque = makeEstoqueMock();
    const svc = new ProducaoService(asPrisma(mock), estoque);

    await svc.mudarStatus('j1', 'IMPRIMINDO');

    expect(estoque.registrarMovimento).not.toHaveBeenCalled();
  });
});
