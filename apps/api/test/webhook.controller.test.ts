import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { WebhookController } from '../src/modules/pedidos/webhook.controller';
import type { AtendimentoService } from '../src/modules/pedidos/atendimento.service';
import type { MercadoLivreClient } from '../src/modules/pedidos/mercadolivre.client';

function montar(over: { configurado?: boolean; buscarPedido?: unknown } = {}) {
  const importar = vi.fn().mockResolvedValue({ novo: true, itensSemVinculo: 0 });
  const buscarPedido = vi.fn().mockResolvedValue({ canal: 'ML', externalId: '123', itens: [] });
  const ml = {
    estaConfigurado: () => over.configurado ?? true,
    buscarPedido,
  } as unknown as MercadoLivreClient;
  const ctrl = new WebhookController({ importar } as unknown as AtendimentoService, ml);
  return { ctrl, importar, buscarPedido };
}

/** O processamento é disparado sem await; cede o event loop pra ele terminar. */
const proximoTick = () => new Promise((r) => setImmediate(r));

describe('WebhookController', () => {
  // O ML considera falha qualquer resposta acima de ~500ms e reenvia. Responder só
  // depois de processar viraria retry infinito em pedido lento.
  it('responde na hora, sem esperar o processamento', () => {
    const { ctrl } = montar();
    expect(ctrl.receber({ topic: 'orders_v2', resource: '/orders/999' })).toEqual({ ok: true });
  });

  it('busca o pedido pela API e importa', async () => {
    const { ctrl, importar, buscarPedido } = montar();
    ctrl.receber({ topic: 'orders_v2', resource: '/orders/2000012345' });
    await proximoTick();

    expect(buscarPedido).toHaveBeenCalledWith('2000012345');
    expect(importar).toHaveBeenCalledOnce();
  });

  it('ignora tópico que não é de pedido', async () => {
    const { ctrl, buscarPedido } = montar();
    ctrl.receber({ topic: 'messages', resource: '/messages/1' });
    await proximoTick();
    expect(buscarPedido).not.toHaveBeenCalled();
  });

  it('não quebra com corpo vazio', async () => {
    const { ctrl, buscarPedido } = montar();
    expect(ctrl.receber({})).toEqual({ ok: true });
    await proximoTick();
    expect(buscarPedido).not.toHaveBeenCalled();
  });

  // Segurança: o corpo do webhook é público e não confiável. Nada dele vira dado —
  // só o id é usado pra reconsultar o pedido pela API autenticada.
  it('não usa o corpo como dado, só o id pra consultar', async () => {
    const { ctrl, importar, buscarPedido } = montar();
    ctrl.receber({
      topic: 'orders_v2',
      resource: '/orders/777',
      ...({ total_amount: 999999, itens: [{ sku: 'FORJADO' }] } as object),
    });
    await proximoTick();

    expect(buscarPedido).toHaveBeenCalledWith('777');
    // O que foi importado veio da API, não do corpo forjado.
    expect(importar.mock.calls[0]?.[0]).toEqual(await buscarPedido.mock.results[0]?.value);
  });

  it('sem credencial configurada, não tenta buscar', async () => {
    const { ctrl, buscarPedido } = montar({ configurado: false });
    ctrl.receber({ topic: 'orders_v2', resource: '/orders/1' });
    await proximoTick();
    expect(buscarPedido).not.toHaveBeenCalled();
  });

  // Falha na busca não pode derrubar o processo: o `void` + catch garante que o erro
  // fique no log em vez de virar unhandled rejection.
  it('erro na busca não propaga', async () => {
    const { ctrl, buscarPedido } = montar();
    buscarPedido.mockRejectedValue(new Error('ML fora do ar'));
    expect(() => ctrl.receber({ topic: 'orders_v2', resource: '/orders/5' })).not.toThrow();
    await proximoTick();
  });
});
