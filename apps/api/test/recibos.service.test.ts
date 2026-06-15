import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { RecibosService } from '../src/modules/recibos/recibos.service';
import type { MediaUrlService } from '../src/modules/imagens/media-url.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

const mediaUrl = {
  publicUrl: (a: string) => `http://media/${a}`,
} as unknown as MediaUrlService;
const config = { get: () => './storage' } as unknown as ConfigService;

describe('RecibosService', () => {
  it('create monta o recibo (data string vira Date)', async () => {
    const { mock } = makePrismaMock();
    mock.recibo.create.mockResolvedValue({
      id: 'r1',
      data: new Date('2026-05-11'),
      fornecedor: 'VOOLT',
      valorCentavos: 382307,
      observacao: null,
      arquivos: [],
    });
    const svc = new RecibosService(asPrisma(mock), mediaUrl, config);

    const r = await svc.create({ data: '2026-05-11', fornecedor: 'VOOLT', valorCentavos: 382307 });

    expect(r.fornecedor).toBe('VOOLT');
    expect(r.valorCentavos).toBe(382307);
    expect(r.arquivos).toEqual([]);
    // a data foi passada ao Prisma como Date
    expect(mock.recibo.create.mock.calls[0]?.[0].data.data).toBeInstanceOf(Date);
  });

  it('get resolve a URL pública de cada anexo', async () => {
    const { mock } = makePrismaMock();
    mock.recibo.findUnique.mockResolvedValue({
      id: 'r1',
      data: new Date(),
      fornecedor: null,
      valorCentavos: null,
      observacao: null,
      arquivos: [
        {
          id: 'a1',
          arquivo: 'recibos/r1/x.pdf',
          nomeOriginal: 'nf.pdf',
          mimeType: 'application/pdf',
          bytes: 100,
          criadoEm: new Date(),
        },
      ],
    });
    const svc = new RecibosService(asPrisma(mock), mediaUrl, config);

    const r = await svc.get('r1');

    expect(r.arquivos[0]?.url).toBe('http://media/recibos/r1/x.pdf');
    expect(r.arquivos[0]?.mimeType).toBe('application/pdf');
  });

  it('addArquivos sem nenhum arquivo é rejeitado', async () => {
    const { mock } = makePrismaMock();
    const svc = new RecibosService(asPrisma(mock), mediaUrl, config);
    await expect(svc.addArquivos('r1', [])).rejects.toBeInstanceOf(BadRequestException);
  });
});
