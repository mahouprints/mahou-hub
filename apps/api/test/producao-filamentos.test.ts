import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ProducaoService } from '../src/modules/producao/producao.service';
import { AtendimentoService } from '../src/modules/pedidos/atendimento.service';
import type { EstoqueService } from '../src/modules/estoque/estoque.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

const pesos = ['0.10', '20.25', '0.33', '12.50', '4.01'];
const consumoEsperado = [0.3, 60.75, 0.99, 37.5, 12.03].map((gramas, indice) => ({
  filamentoId: `f${indice + 1}`,
  gramas,
}));

function jobComReceita() {
  return {
    id: 'j1',
    qtd: 3,
    status: 'IMPRIMINDO',
    daEstoque: false,
    consumoRegistrado: false,
    consumoProdutoRegistrado: false,
    consumoFilamentos: null,
    variacaoId: null,
    dataFim: null,
    produto: {
      nome: 'Luminária',
      filamentoId: 'f1',
      pesoG: new Prisma.Decimal('37.19'),
      filamentos: pesos.map((pesoG, indice) => ({
        filamentoId: `f${indice + 1}`,
        pesoG: new Prisma.Decimal(pesoG),
      })),
    },
    variacao: null,
  };
}

function preparar() {
  const { mock, tx } = makePrismaMock();
  tx.jobProducao.findUnique.mockResolvedValue(jobComReceita());
  tx.jobProducao.update.mockResolvedValue({ id: 'j1' });
  tx.jobProducao.delete.mockResolvedValue({ id: 'j1' });
  const estoque = { registrarEmTransacao: vi.fn().mockResolvedValue({}) };
  const service = new ProducaoService(asPrisma(mock), estoque as unknown as EstoqueService);
  return { mock, tx, estoque, service };
}

describe('produção com múltiplos filamentos', () => {
  it('envio direto pelo marketplace reutiliza a produção e baixa os cinco filamentos', async () => {
    const { mock, tx, estoque, service } = preparar();
    mock.jobProducao.findMany.mockResolvedValue([{ id: 'j1' }]);
    const prisma = {
      ...mock,
      pedidoMarketplace: {
        findUnique: vi.fn().mockResolvedValue({ id: 'ped1', status: 'ATENDIDO' }),
        update: vi.fn().mockResolvedValue({}),
      },
      pedidoItem: { findMany: vi.fn().mockResolvedValue([{ jobProducaoId: 'j1' }]) },
    };
    const atendimento = new AtendimentoService(asPrisma(prisma), service);

    await atendimento.importar({
      canal: 'SHOPEE',
      externalId: 'pedido1',
      statusExterno: 'SHIPPED',
      totalCentavos: 1000,
      dataPedido: new Date(),
      itens: [{ skuExterno: 'sku', nomeExterno: 'Luminária', qtd: 3, precoUnitarioCentavos: 1000 }],
    });

    expect(estoque.registrarEmTransacao).toHaveBeenCalledTimes(5);
    expect(tx.jobProducao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ENVIADO', consumoFilamentos: consumoEsperado }),
      }),
    );
    expect(prisma.pedidoMarketplace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ENVIADO' }),
      }),
    );
  });

  it('baixa cinco materiais pelos pesos informados × quantidade, sem perder frações de grama', async () => {
    const { mock, tx, estoque, service } = preparar();

    await service.mudarStatus('j1', 'CONCLUIDO');

    expect(estoque.registrarEmTransacao).toHaveBeenCalledTimes(5);
    for (const [indice, item] of consumoEsperado.entries()) {
      expect(estoque.registrarEmTransacao).toHaveBeenNthCalledWith(
        indice + 1,
        tx,
        expect.objectContaining({
          tipoItem: 'FILAMENTO',
          filamentoId: item.filamentoId,
          quantidade: -item.gramas,
        }),
        { permitirNegativo: true },
      );
    }
    expect(tx.jobProducao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consumoRegistrado: true,
          consumoFilamentos: consumoEsperado,
        }),
      }),
    );
    expect(mock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('estorna o snapshot de cinco materiais mesmo após mudança da receita, variação e quantidade', async () => {
    const { tx, estoque, service } = preparar();
    tx.jobProducao.findUnique.mockResolvedValue({
      ...jobComReceita(),
      qtd: 20,
      consumoRegistrado: true,
      consumoFilamentos: consumoEsperado,
      produto: { nome: 'Receita alterada', pesoG: 1000, filamentoId: 'novo', filamentos: [] },
      variacao: { nome: 'Outra cor', filamentoId: 'outra', pesoG: 800 },
    });

    const resultado = await service.remove('j1');

    expect(estoque.registrarEmTransacao).toHaveBeenCalledTimes(5);
    for (const item of consumoEsperado) {
      expect(estoque.registrarEmTransacao).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ filamentoId: item.filamentoId, quantidade: item.gramas }),
        { permitirNegativo: true },
      );
    }
    expect(resultado).toMatchObject({ estornado: true, gramas: 111.57 });
    expect(tx.jobProducao.delete).toHaveBeenCalledWith({ where: { id: 'j1' } });
  });

  it('não baixa de novo ao embalar um job que já registrou todos os materiais', async () => {
    const { tx, estoque, service } = preparar();
    tx.jobProducao.findUnique.mockResolvedValue({
      ...jobComReceita(),
      consumoRegistrado: true,
      consumoFilamentos: consumoEsperado,
    });

    await service.mudarStatus('j1', 'EMBALADO');

    expect(estoque.registrarEmTransacao).not.toHaveBeenCalled();
  });

  it.each([
    [{ nome: 'Vermelho', filamentoId: 'vermelho', pesoG: null }, 'Herdar do produto'],
    [{ nome: 'Kit', filamentoId: null, pesoG: 100 }, 'pesos por filamento'],
  ])('recusa override ambíguo antes de baixar qualquer material', async (variacao, mensagem) => {
    const { tx, estoque, service } = preparar();
    tx.jobProducao.findUnique.mockResolvedValue({ ...jobComReceita(), variacaoId: 'v1', variacao });

    await expect(service.mudarStatus('j1', 'CONCLUIDO')).rejects.toThrow(mensagem);

    expect(estoque.registrarEmTransacao).not.toHaveBeenCalled();
    expect(tx.jobProducao.update).not.toHaveBeenCalled();
  });

  it('permite variação que herda a receita e informa o mesmo peso total', async () => {
    const { tx, estoque, service } = preparar();
    tx.jobProducao.findUnique.mockResolvedValue({
      ...jobComReceita(),
      variacaoId: 'v1',
      variacao: { nome: 'Padrão', filamentoId: null, pesoG: new Prisma.Decimal('37.19') },
    });

    await service.mudarStatus('j1', 'CONCLUIDO');

    expect(estoque.registrarEmTransacao).toHaveBeenCalledTimes(5);
  });

  it('propaga falha na terceira cor sem confirmar status ou flags fora da transação', async () => {
    const { mock, tx, estoque, service } = preparar();
    estoque.registrarEmTransacao
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Falha no terceiro material'));

    await expect(service.mudarStatus('j1', 'CONCLUIDO')).rejects.toThrow('terceiro material');

    expect(tx.jobProducao.update).not.toHaveBeenCalled();
    expect(mock.jobProducao.update).not.toHaveBeenCalled();
    expect(estoque.registrarEmTransacao.mock.calls.every(([transacao]) => transacao === tx)).toBe(
      true,
    );
  });

  it('receita vazia usa peso e rolo legados, preservando centésimos nas novas baixas', async () => {
    const { tx, estoque, service } = preparar();
    const job = jobComReceita();
    tx.jobProducao.findUnique.mockResolvedValue({
      ...job,
      produto: { ...job.produto, pesoG: new Prisma.Decimal('10.25'), filamentos: [] },
    });

    await service.mudarStatus('j1', 'CONCLUIDO');

    expect(estoque.registrarEmTransacao).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ filamentoId: 'f1', quantidade: -30.75 }),
      { permitirNegativo: true },
    );
  });

  it('job legado sem snapshot estorna o rolo e arredondamento usados antes da composição', async () => {
    const { tx, estoque, service } = preparar();
    tx.jobProducao.findUnique.mockResolvedValue({
      ...jobComReceita(),
      consumoRegistrado: true,
      variacao: { nome: 'Azul', filamentoId: 'azul-antigo', pesoG: new Prisma.Decimal('10.25') },
    });

    await service.remove('j1');

    expect(estoque.registrarEmTransacao).toHaveBeenCalledTimes(1);
    expect(estoque.registrarEmTransacao).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ filamentoId: 'azul-antigo', quantidade: 31 }),
      { permitirNegativo: true },
    );
  });
});
