import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { CustoCreate } from '@mahou-hub/contracts';
import type { PrismaService } from '../src/prisma/prisma.service';
import { CustosService } from '../src/modules/custos/custos.service';

function prepararCustos() {
  const custo = {
    create: vi.fn().mockResolvedValue({ id: 'custo-original' }),
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = { custo } as unknown as PrismaService;
  return { custo, service: new CustosService(prisma) };
}

function entrada(dataCompetencia: string, mesesRecorrencia?: number): CustoCreate {
  return {
    descricao: 'Assinatura mensal',
    categoria: 'ASSINATURA',
    valorCentavos: 2500,
    dataCompetencia: new Date(dataCompetencia),
    recorrente: true,
    observacao: 'Pagamento da assinatura',
    mesesRecorrencia,
  };
}

describe('CustosService — dia dos custos recorrentes', () => {
  it.each([
    ['2026-09-22', ['2026-10-22', '2026-11-22', '2026-12-22', '2027-01-22']],
    ['2026-01-31', ['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']],
    ['2028-01-31', ['2028-02-29', '2028-03-31', '2028-04-30']],
    ['2026-01-30', ['2026-02-28', '2026-03-30', '2026-04-30']],
    ['2028-02-29', ['2028-03-29', '2028-04-29', '2028-05-29']],
    ['2026-12-31', ['2027-01-31', '2027-02-28', '2027-03-31']],
  ])('mantém o dia original de %s, sem acumular ajuste de mês curto', async (dia, esperados) => {
    const { custo, service } = prepararCustos();
    const original = entrada(`${dia}T00:00:00.000Z`, esperados.length);
    await service.create(original);
    const futuros = custo.createMany.mock.calls[0]?.[0].data as CustoCreate[];
    expect(futuros.map((item) => item.dataCompetencia.toISOString())).toEqual(
      esperados.map((esperado) => `${esperado}T00:00:00.000Z`),
    );
    expect(original.dataCompetencia.toISOString()).toBe(`${dia}T00:00:00.000Z`);
  });

  it('usa o dia UTC, mesmo quando o instante corresponde a outro dia no fuso local', async () => {
    const { custo, service } = prepararCustos();
    await service.create(entrada('2026-01-30T23:30:00-03:00', 2));
    const futuros = custo.createMany.mock.calls[0]?.[0].data as CustoCreate[];
    expect(futuros.map((item) => item.dataCompetencia.toISOString())).toEqual([
      '2026-02-28T00:00:00.000Z',
      '2026-03-31T00:00:00.000Z',
    ]);
  });

  it('mantém 12 cópias por padrão e os dados do custo sem repetir a recorrência', async () => {
    const { custo, service } = prepararCustos();
    const original = entrada('2028-02-29T00:00:00.000Z');
    expect(await service.create(original)).toEqual({ id: 'custo-original' });
    const futuros = custo.createMany.mock.calls[0]?.[0].data as CustoCreate[];
    expect(futuros).toHaveLength(12);
    expect(futuros[0]?.dataCompetencia.toISOString()).toBe('2028-03-29T00:00:00.000Z');
    expect(futuros[11]?.dataCompetencia.toISOString()).toBe('2029-02-28T00:00:00.000Z');
    for (const futuro of futuros) {
      expect(futuro).toMatchObject({
        descricao: original.descricao,
        categoria: original.categoria,
        valorCentavos: original.valorCentavos,
        observacao: original.observacao,
        recorrente: false,
        geradoAutomatico: true,
      });
    }
    expect(custo.create.mock.calls[0]?.[0].data).toMatchObject({
      dataCompetencia: original.dataCompetencia,
      recorrente: true,
      geradoAutomatico: false,
    });
    expect(custo.create.mock.calls[0]?.[0].data).not.toHaveProperty('mesesRecorrencia');
  });

  it('custo avulso conserva o dia informado sem gerar cópias', async () => {
    const { custo, service } = prepararCustos();
    const original = { ...entrada('2026-09-22T00:00:00.000Z', 3), recorrente: false };
    await service.create(original);
    expect(custo.create).toHaveBeenCalledWith({
      data: {
        descricao: original.descricao,
        categoria: original.categoria,
        valorCentavos: original.valorCentavos,
        dataCompetencia: original.dataCompetencia,
        recorrente: false,
        observacao: original.observacao,
        geradoAutomatico: false,
      },
    });
    expect(custo.createMany).not.toHaveBeenCalled();
  });
});
