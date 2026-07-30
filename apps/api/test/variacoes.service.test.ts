import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VariacoesService } from '../src/modules/variacoes/variacoes.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

function montar(
  opts: { siglaCor?: string | null; skusOcupados?: string[]; nomeFilamento?: string } = {},
) {
  const { mock } = makePrismaMock();
  mock.produto.findUnique.mockResolvedValue({ id: 'p1', nome: 'Suporte de Móbile de Berço' });
  // `in` e não `??`: o teste da sigla ausente passa null de propósito.
  mock.filamento.findUnique.mockResolvedValue({
    siglaCor: 'siglaCor' in opts ? opts.siglaCor : 'AZ',
    nome: opts.nomeFilamento ?? 'PLA Azul Voolt',
  });
  const ocupados = new Set(opts.skusOcupados ?? []);
  mock.produtoVariacao.findUnique.mockImplementation((args: { where: { sku?: string } }) =>
    Promise.resolve(args.where.sku && ocupados.has(args.where.sku) ? { id: 'ja-existe' } : null),
  );
  mock.produtoVariacao.create.mockImplementation((args: { data: unknown }) =>
    Promise.resolve(args.data),
  );
  return { svc: new VariacoesService(asPrisma(mock)), mock };
}

describe('VariacoesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gera o SKU quando não recebe um, usando a sigla da cor do filamento', async () => {
    const { svc, mock } = montar({ siglaCor: 'AZ' });

    await svc.create({ produtoId: 'p1', nome: 'Azul', filamentoId: 'f1' });

    const criado = mock.produtoVariacao.create.mock.calls[0]?.[0].data;
    expect(criado.sku).toBe('SUPORTE-MOBILE-BERCO-AZ');
  });

  it('respeita o SKU que veio digitado à mão', async () => {
    const { svc, mock } = montar();

    await svc.create({ produtoId: 'p1', nome: 'Azul', sku: 'MEU-CODIGO-AZ' });

    expect(mock.produtoVariacao.create.mock.calls[0]?.[0].data.sku).toBe('MEU-CODIGO-AZ');
  });

  it('desvia para um código livre quando o gerado já existe', async () => {
    // Dois produtos de nome parecido chegam na mesma base — o segundo não pode explodir
    // na cara de quem só queria cadastrar uma cor.
    const { svc, mock } = montar({ skusOcupados: ['SUPORTE-MOBILE-BERCO-AZ'] });

    await svc.create({ produtoId: 'p1', nome: 'Azul', filamentoId: 'f1' });

    const sku = mock.produtoVariacao.create.mock.calls[0]?.[0].data.sku;
    expect(sku).not.toBe('SUPORTE-MOBILE-BERCO-AZ');
    expect(sku).toMatch(/-2$/);
    expect(sku.length).toBeLessThanOrEqual(24);
  });

  it('deduz a sigla do nome do filamento quando não há uma cadastrada', async () => {
    // Regressão (30/07/2026): sem sigla o SKU saía sem cor nenhuma, e três cores do mesmo
    // produto viravam SUPORTE-MOBILE-BERCO, -2 e -3.
    const { svc, mock } = montar({ siglaCor: null, nomeFilamento: 'PLA Vermelho Velvet Voolt' });

    await svc.create({ produtoId: 'p1', nome: 'Vermelho', filamentoId: 'f1' });

    expect(mock.produtoVariacao.create.mock.calls[0]?.[0].data.sku).toBe('SUPORTE-MOBILE-BERCO-VM');
  });

  it('deduz a cor do NOME DA VARIAÇÃO quando não há filamento vinculado', async () => {
    const { svc, mock } = montar();

    await svc.create({ produtoId: 'p1', nome: 'Preto' });

    expect(mock.produtoVariacao.create.mock.calls[0]?.[0].data.sku).toBe('SUPORTE-MOBILE-BERCO-PT');
  });

  it('grava peso e tempo próprios — é o que faz kit não mentir', async () => {
    const { svc, mock } = montar();

    await svc.create({ produtoId: 'p1', nome: 'Kit 3', sku: 'KIT3-AZ', pesoG: 96, tempoH: 4.5 });

    const criado = mock.produtoVariacao.create.mock.calls[0]?.[0].data;
    expect(criado.pesoG).toBe(96);
    expect(criado.tempoH).toBe(4.5);
  });

  it('deixa peso e tempo nulos na variação de cor, que herda do produto', async () => {
    const { svc, mock } = montar();

    await svc.create({ produtoId: 'p1', nome: 'Azul', sku: 'SUP-AZ' });

    const criado = mock.produtoVariacao.create.mock.calls[0]?.[0].data;
    expect(criado.pesoG).toBeNull();
    expect(criado.tempoH).toBeNull();
  });

  it('SKU repetido vira mensagem que se entende, não erro 500', async () => {
    const { svc, mock } = montar();
    mock.produtoVariacao.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '5',
        meta: { target: ['sku'] },
      }),
    );

    await expect(
      svc.create({ produtoId: 'p1', nome: 'Azul', sku: 'REPETIDO-AZ' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(svc.create({ produtoId: 'p1', nome: 'Azul', sku: 'REPETIDO-AZ' })).rejects.toThrow(
      /já está em uso/,
    );
  });

  it('não engole outros erros do banco como se fossem SKU repetido', async () => {
    const { svc, mock } = montar();
    mock.produtoVariacao.create.mockRejectedValue(new Error('conexão caiu'));

    await expect(svc.create({ produtoId: 'p1', nome: 'Azul', sku: 'SUP-AZ' })).rejects.toThrow(
      /conexão caiu/,
    );
  });

  describe('criarEmLote', () => {
    function montarLote(opts: {
      produtos?: Array<{ id: string; nome: string }>;
      filamentos?: Array<{ id: string; nome: string; siglaCor: string | null }>;
      jaExistem?: Array<{ produtoId: string; filamentoId: string }>;
    }) {
      const { mock } = makePrismaMock();
      mock.produto.findMany.mockResolvedValue(
        opts.produtos ?? [
          { id: 'p1', nome: 'Suporte de Móbile' },
          { id: 'p2', nome: 'Abajur Nuvem' },
        ],
      );
      mock.filamento.findMany.mockResolvedValue(
        opts.filamentos ?? [
          { id: 'f1', nome: 'Azul', siglaCor: 'AZ' },
          { id: 'f2', nome: 'Rosa', siglaCor: 'RS' },
        ],
      );
      mock.produtoVariacao.findMany.mockResolvedValue(opts.jaExistem ?? []);
      mock.produtoVariacao.findUnique.mockResolvedValue(null);
      mock.produtoVariacao.create.mockImplementation((args: { data: unknown }) =>
        Promise.resolve(args.data),
      );
      return { svc: new VariacoesService(asPrisma(mock)), mock };
    }

    it('cria a combinação produto × cor', async () => {
      const { svc, mock } = montarLote({});

      const r = await svc.criarEmLote({
        produtoIds: ['p1', 'p2'],
        filamentoIds: ['f1', 'f2'],
      });

      expect(r.criadas).toBe(4);
      expect(r.puladas).toBe(0);
      expect(mock.produtoVariacao.create).toHaveBeenCalledTimes(4);
      expect(r.novas.map((n) => n.sku)).toEqual([
        'SUPORTE-MOBILE-AZ',
        'SUPORTE-MOBILE-RS',
        'ABAJUR-NUVEM-AZ',
        'ABAJUR-NUVEM-RS',
      ]);
    });

    it('usa o nome do filamento como nome da variação', async () => {
      const { svc, mock } = montarLote({ produtos: [{ id: 'p1', nome: 'Abajur Nuvem' }] });

      await svc.criarEmLote({ produtoIds: ['p1'], filamentoIds: ['f1', 'f2'] });

      const nomes = mock.produtoVariacao.create.mock.calls.map((c) => c[0].data.nome);
      expect(nomes).toEqual(['Azul', 'Rosa']);
    });

    it('pula a combinação que já existe — rodar de novo não duplica', async () => {
      const { svc, mock } = montarLote({
        produtos: [{ id: 'p1', nome: 'Abajur Nuvem' }],
        jaExistem: [{ produtoId: 'p1', filamentoId: 'f1' }],
      });

      const r = await svc.criarEmLote({ produtoIds: ['p1'], filamentoIds: ['f1', 'f2'] });

      expect(r.criadas).toBe(1);
      expect(r.puladas).toBe(1);
      expect(mock.produtoVariacao.create).toHaveBeenCalledTimes(1);
      expect(r.novas[0]?.cor).toBe('Rosa');
    });

    it('cor sem sigla cadastrada não trava o lote — a sigla sai do nome', async () => {
      const { svc } = montarLote({
        produtos: [{ id: 'p1', nome: 'Abajur Nuvem' }],
        filamentos: [
          { id: 'f1', nome: 'PLA Azul Voolt', siglaCor: 'AZ' },
          { id: 'f2', nome: 'PLA Rosa Velvet Voolt', siglaCor: null },
        ],
      });

      const r = await svc.criarEmLote({ produtoIds: ['p1'], filamentoIds: ['f1', 'f2'] });

      expect(r.criadas).toBe(2);
      expect(r.novas.map((n) => n.sku)).toEqual(['ABAJUR-NUVEM-AZ', 'ABAJUR-NUVEM-RS']);
    });
  });

  it('recusa criar variação de produto que não existe', async () => {
    const { svc, mock } = montar();
    mock.produto.findUnique.mockResolvedValue(null);

    await expect(svc.create({ produtoId: 'nada', nome: 'Azul' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
