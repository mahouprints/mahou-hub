import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ProdutoCreateSchema, ProdutoUpdateSchema } from '@mahou-hub/contracts';
import { ProdutosService } from '../src/modules/produtos/produtos.service';
import type { ImagensService } from '../src/modules/imagens/imagens.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

const filamentos = [10.25, 5.1, 8, 4.65, 2].map((pesoG, i) => ({ filamentoId: `f${i}`, pesoG }));
const base = ProdutoCreateSchema.parse({
  nome: 'Placa de teste',
  inspiracao: null,
  modelo3dUrl: null,
  larguraCm: null,
  alturaCm: null,
  profundidadeCm: null,
  filamentoId: 'f0',
  pesoG: 30,
  tempoH: 2,
  impressora: 'H2C',
  embalagemCentavos: 150,
  precoCentavos: 2500,
  canalPrincipal: 'SITE',
});

function preparar(composicao = filamentos) {
  const { mock, tx } = makePrismaMock();
  tx.produto.findUnique.mockResolvedValue({
    ...base,
    id: 'produto',
    rascunho: false,
    filamentos: composicao,
    pesoG: new Prisma.Decimal(30),
  });
  const svc = new ProdutosService(asPrisma(mock), {
    paraDto: vi.fn(),
  } as unknown as ImagensService);
  return { svc, mock, tx };
}

describe('composição por unidade do produto', () => {
  it('grava cinco filamentos e deriva peso total e referência dos materiais informados', async () => {
    const { svc, mock } = preparar();
    await svc.create({ ...base, filamentoId: 'ignorado', pesoG: 999, filamentos });
    expect(mock.produto.create.mock.calls[0]?.[0].data).toMatchObject({
      pesoG: 30,
      filamentoId: 'f0',
      filamentos: { create: filamentos.map((f, ordem) => ({ ...f, ordem })) },
    });
  });

  it('troca composição inteira em transação e remove materiais excluídos', async () => {
    const { svc, tx } = preparar();
    await svc.update('produto', { filamentos: [{ filamentoId: 'f4', pesoG: 12.35 }] });
    expect(tx.produto.update).toHaveBeenCalledWith({
      where: { id: 'produto' },
      data: { filamentoId: 'f4', pesoG: 12.35 },
    });
    expect(tx.produtoFilamento.deleteMany).toHaveBeenCalledWith({
      where: { produtoId: 'produto' },
    });
    expect(tx.produtoFilamento.createMany).toHaveBeenCalledWith({
      data: [{ produtoId: 'produto', filamentoId: 'f4', pesoG: 12.35, ordem: 0 }],
    });
  });

  it('editar preço preserva a composição', async () => {
    const { svc, tx } = preparar();
    await svc.update('produto', { precoCentavos: 4000 });
    expect(tx.produtoFilamento.deleteMany).not.toHaveBeenCalled();
  });

  it('não aceita cliente antigo sobrescrever peso/material de produto multicolorido', async () => {
    const { svc, tx } = preparar();
    await expect(svc.update('produto', { pesoG: 80 })).rejects.toThrow(/composição completa/);
    await expect(svc.update('produto', { filamentoId: 'outro' })).rejects.toThrow(
      /composição completa/,
    );
    expect(tx.produto.update).not.toHaveBeenCalled();
  });

  it('permite ecoar os campos legados sem modificar composição', async () => {
    const { svc, tx } = preparar();
    await svc.update('produto', { nome: 'Novo nome', pesoG: 30, filamentoId: 'f0' });
    expect(tx.produtoFilamento.deleteMany).not.toHaveBeenCalled();
  });

  it('atualização antiga de produto single mantém a linha sincronizada', async () => {
    const { svc, tx } = preparar([{ filamentoId: 'f0', pesoG: 30 }]);
    await svc.update('produto', { pesoG: 40 });
    expect(tx.produtoFilamento.createMany).toHaveBeenCalledWith({
      data: [{ produtoId: 'produto', filamentoId: 'f0', pesoG: 40, ordem: 0 }],
    });
  });

  it('legado sem linhas continua aceitando alteração de peso', async () => {
    const { svc, tx } = preparar([]);
    await svc.update('produto', { pesoG: 40 });
    expect(tx.produto.update).toHaveBeenCalledWith({
      where: { id: 'produto' },
      data: { pesoG: 40 },
    });
    expect(tx.produtoFilamento.deleteMany).not.toHaveBeenCalled();
  });

  it.each([
    [],
    [{ filamentoId: 'f0', pesoG: 0 }],
    [{ filamentoId: 'f0', pesoG: -1 }],
    [{ filamentoId: 'f0', pesoG: 0.001 }],
    [{ filamentoId: '', pesoG: 1 }],
    [
      { filamentoId: 'f0', pesoG: 1 },
      { filamentoId: 'f0', pesoG: 2 },
    ],
  ])('rejeita receita vazia, inválida ou duplicada: %j', (...itens) => {
    expect(ProdutoUpdateSchema.safeParse({ filamentos: itens }).success).toBe(false);
  });

  it('aceita receita válida com precisão de 0,01 g', () => {
    expect(ProdutoUpdateSchema.safeParse({ filamentos }).success).toBe(true);
  });
});
