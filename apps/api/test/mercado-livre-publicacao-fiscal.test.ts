import 'reflect-metadata';
import { BadGatewayException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PublicacaoService } from '../src/modules/mercado-livre/publicacao/publicacao.service';
import { aptidaoFiscalNoDetalhe } from '../src/modules/mercado-livre/publicacao/publicacao-verificacao';
import type { PublicacaoItem } from '../src/modules/mercado-livre/publicacao/publicacao-schema';
import type {
  RegistroItem,
  PublicacaoJournal,
} from '../src/modules/mercado-livre/publicacao/publicacao-journal';
import type { MercadoLivreHttpService } from '../src/modules/mercado-livre/mercado-livre-http.service';

const cadastro = {
  sku: 'DRAG-BR',
  title: 'Mini Dragao',
  type: 'single' as const,
  measurement_unit: 'UN' as const,
  cost: 1.34,
  tax_information: {
    ncm: '95030039',
    origin_type: 'manufacturer' as const,
    origin_detail: '0',
    csosn: '102',
    net_weight: 0.013,
    gross_weight: 0.023,
  },
};
const detalhe = {
  item_id: 'MLB123',
  seller_id: '42',
  sku: { ...cadastro, seller_id: '42', can_invoice: true, can_resale: false },
};

function preparar(detalheFiscal: unknown) {
  const get = vi.fn(async (path: string) => {
    if (path === '/items/fiscal_information/DRAG-BR') return cadastro;
    if (path === '/items/MLB123/fiscal_information/detail') return detalheFiscal;
    throw new BadGatewayException({ mercadoLivreStatus: 403 });
  });
  const post = vi.fn();
  const service = new PublicacaoService(
    { sellerId: '42', get, post, put: vi.fn() } as unknown as MercadoLivreHttpService,
    { carregar: vi.fn(), registrar: vi.fn() },
    {} as PublicacaoJournal,
  );
  const item = { fiscais: [{ sku: 'DRAG-BR', cadastro }] } as PublicacaoItem;
  const salvo: RegistroItem = { estado: 'CRIADO', itemId: 'MLB123' };
  const concluir = () =>
    (
      service as unknown as {
        concluirFiscal(item: PublicacaoItem, salvo: RegistroItem): Promise<void>;
      }
    ).concluirFiscal(item, salvo);
  return { get, post, salvo, concluir };
}

describe('Aptidão explícita no detalhe fiscal', () => {
  it('confirma item/vendedor/SKU exatos sem chamar endpoint separado e sem exigir revenda', async () => {
    const contexto = preparar(detalhe);
    await contexto.concluir();
    expect(contexto.salvo.fiscalConfirmado).toBe(true);
    expect(contexto.get.mock.calls.some(([path]) => path.startsWith('/can_invoice'))).toBe(false);
    expect(contexto.post).not.toHaveBeenCalled();
  });

  it.each([
    { ...detalhe, item_id: 'MLB999' },
    { ...detalhe, seller_id: '99' },
    { ...detalhe, sku: { ...detalhe.sku, seller_id: '99' } },
    { ...detalhe, sku: { ...detalhe.sku, sku: 'OUTRO' } },
    { ...detalhe, sku: { ...detalhe.sku, can_invoice: false } },
    { ...detalhe, sku: { ...detalhe.sku, can_invoice: 'true' } },
  ])('rejeita identidade divergente, SKU errado e aptidão não verdadeira: %j', async (recebido) => {
    expect(aptidaoFiscalNoDetalhe(recebido, 'MLB123', '42', 'DRAG-BR')).toBe(false);
    const contexto = preparar(recebido);
    await expect(contexto.concluir()).rejects.toThrow();
    expect(contexto.salvo.fiscalConfirmado).not.toBe(true);
  });

  it('mantém a consulta separada quando o detalhe não informa aptidão', async () => {
    const contexto = preparar([{ item_id: 'MLB123', sku: 'DRAG-BR' }]);
    await expect(contexto.concluir()).rejects.toThrow();
    expect(contexto.get).toHaveBeenCalledWith('/can_invoice/items/MLB123');
  });

  it('rejeita campos fiscais divergentes apesar do can_invoice true', async () => {
    const contexto = preparar({
      ...detalhe,
      sku: { ...detalhe.sku, tax_information: { ...cadastro.tax_information, csosn: '500' } },
    });
    await expect(contexto.concluir()).rejects.toThrow('Detalhe fiscal divergente');
    expect(contexto.salvo.fiscalConfirmado).not.toBe(true);
  });
});
