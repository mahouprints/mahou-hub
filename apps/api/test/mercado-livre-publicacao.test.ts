import 'reflect-metadata';
import { BadGatewayException } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicacaoJournal } from '../src/modules/mercado-livre/publicacao/publicacao-journal';
import { PublicacaoService } from '../src/modules/mercado-livre/publicacao/publicacao.service';
import {
  PublicacaoEntradaSchema,
  type CatalogoPublicacao,
  type PublicacaoEntrada,
  type PublicacaoItem,
} from '../src/modules/mercado-livre/publicacao/publicacao-schema';
import {
  contemCampos,
  objeto,
} from '../src/modules/mercado-livre/publicacao/publicacao-verificacao';
import { entradaStdin } from '../scripts/mercado-livre-publicar';
import {
  formatarErroPublicacao,
  PublicacaoErro,
} from '../src/modules/mercado-livre/publicacao/publicacao-erro';

const temporarios: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporarios.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const ausente = () => new BadGatewayException({ mercadoLivreStatus: 404 });

function plano(
  prefixo = 'DRAG',
  modelo: PublicacaoEntrada['modelo'] = 'legacy',
): PublicacaoEntrada {
  const skus = Array.from({ length: 7 }, (_, indice) => ({
    sku: `${prefixo}-COR-${indice}`,
    quantidade: indice === 0 ? 8 : 2,
  }));
  const fiscais: PublicacaoItem['fiscais'] = skus.map(({ sku }) => ({
    sku,
    cadastro: {
      sku,
      title: `Colecionável ${sku}`,
      type: 'single',
      measurement_unit: 'UN',
      cost: 1.34,
      tax_information: {
        ncm: '95030039',
        origin_type: 'manufacturer',
        origin_detail: '0',
        csosn: '102',
        net_weight: 0.013,
        gross_weight: 0.023,
      },
    },
  }));
  const variacoes = skus.map(({ sku, quantidade }, indice) => ({
    price: 22.9,
    available_quantity: quantidade,
    attributes: [{ id: 'SELLER_SKU', value_name: sku }],
    attribute_combinations: [{ id: 'COLOR', value_name: `Cor ${indice}` }],
  }));
  const base = {
    category_id: 'MLB1839',
    currency_id: 'BRL' as const,
    buying_mode: 'buy_it_now' as const,
    listing_type_id: 'gold_special',
    condition: 'new' as const,
    pictures: [{ source: 'https://media.mahouprints.com/foto.jpg' }],
    attributes: [{ id: 'BRAND', value_name: 'Mahou Prints' }],
  };
  const descricao = 'Colecionável para maiores de 14 anos. Não é um brinquedo.';
  const itens: PublicacaoItem[] =
    modelo === 'legacy'
      ? [
          {
            chave: prefixo,
            skus,
            payload: { ...base, title: 'Mini dragão colecionável', variations: variacoes },
            descricao,
            fiscais,
          },
        ]
      : skus.map((cor, indice) => ({
          chave: `${prefixo}-${indice}`,
          skus: [cor],
          payload: {
            ...base,
            family_name: 'Mini dragão colecionável',
            price: 22.9,
            available_quantity: cor.quantidade,
            attributes: [...base.attributes, ...variacoes[indice]!.attributes],
          },
          descricao,
          fiscais: [fiscais[indice]!],
        }));
  return {
    modo: 'publicar',
    execucaoId: 'teste-estavel',
    modelo,
    produtos: [{ produtoId: prefixo, precoCentavos: 2290, quantidadeTotal: 20, itens }],
  };
}

async function preparar(entrada = plano()) {
  const diretorio = await mkdtemp(join(tmpdir(), 'ml-publicacao-'));
  temporarios.push(diretorio);
  const catalogo: CatalogoPublicacao[] = entrada.produtos.map((produto) => ({
    id: produto.produtoId,
    ativo: true,
    precoCentavos: 2290,
    variacoes: produto.itens
      .flatMap((item) => item.skus)
      .map((cor) => ({
        sku: cor.sku,
        ativo: true,
        precoCentavos: 2290,
        pesoG: 13,
        filamentoId: 'PLA',
        filamentoAtivo: true,
        estoqueGramas: 1000,
      })),
  }));
  const anuncios = new Map<string, Record<string, unknown>>();
  const descricoes = new Map<string, unknown>();
  const fiscais = new Map<string, unknown>();
  const vinculos = new Map<string, unknown[]>();
  const get = vi.fn(async (path: string): Promise<unknown> => {
    if (path === '/users/42')
      return {
        id: 42,
        site_id: 'MLB',
        tags: entrada.modelo === 'user_products' ? ['user_product_seller'] : [],
      };
    if (path.startsWith('/user-products/')) return { family_id: 9000 };
    if (path.includes('/items/search?')) {
      const sku = new URL(`https://example.test${path}`).searchParams.get('seller_sku');
      const results = [...anuncios.entries()]
        .filter(
          ([, item]) =>
            JSON.stringify(item.attributes ?? []).includes(`"${sku}"`) ||
            JSON.stringify(item.variations ?? []).includes(`"${sku}"`),
        )
        .map(([id]) => id);
      return { results, paging: { total: results.length } };
    }
    if (path.startsWith('/items/fiscal_information/')) {
      const fiscal = fiscais.get(path.split('/').at(-1)!);
      if (!fiscal) throw ausente();
      return fiscal;
    }
    if (path.endsWith('/description')) {
      if (!descricoes.has(path)) throw ausente();
      return descricoes.get(path);
    }
    if (path.endsWith('/fiscal_information/detail')) return vinculos.get(path.split('/')[2]!) ?? [];
    if (path.startsWith('/can_invoice/items/'))
      return { item_id: path.split('/').at(-1), seller_id: 42, status: true };
    if (path.startsWith('/items/')) return anuncios.get(path.split('/')[2]!.split('?')[0]!);
    return {};
  });
  const post = vi.fn(async (path: string, body: unknown): Promise<unknown> => {
    if (path === '/items/validate') return {};
    if (path === '/items') {
      const payload = objeto(body);
      const id = `MLB${1000 + anuncios.size}`;
      const item = {
        ...payload,
        id,
        seller_id: 42,
        status: 'active',
        ...(payload.family_name ? { user_product_id: `MLBU${1000 + anuncios.size}` } : {}),
        ...(Array.isArray(payload.variations)
          ? {
              variations: payload.variations.map((cor, indice) => ({
                ...objeto(cor),
                id: 8000 + indice,
              })),
            }
          : {}),
      };
      anuncios.set(id, item);
      return item;
    }
    if (path.endsWith('/description')) {
      descricoes.set(path, body);
      return body;
    }
    if (path === '/items/fiscal_information') {
      fiscais.set(String(objeto(body).sku), body);
      return body;
    }
    if (path === '/items/fiscal_information/items') {
      const id = String(objeto(body).item_id);
      vinculos.set(id, [...(vinculos.get(id) ?? []), body]);
      return body;
    }
    throw new Error('Rota não simulada');
  });
  const http = {
    sellerId: '42',
    get: get as <T>(path: string) => Promise<T>,
    post: post as <T>(path: string, body: unknown) => Promise<T>,
    put: vi.fn(),
  };
  const repositorio = {
    carregar: vi.fn(async () => catalogo),
    registrar: vi.fn(async () => undefined),
  };
  const journal = new PublicacaoJournal(diretorio, '42');
  return {
    service: new PublicacaoService(http, repositorio, journal),
    diretorio,
    journal,
    http,
    get,
    post,
    repositorio,
    anuncios,
    catalogo,
    descricoes,
    fiscais,
    vinculos,
    entrada,
  };
}

describe('Publicação Mercado Livre', () => {
  it('preserva caracteres UTF-8 cortados entre buffers do STDIN', async () => {
    const esperado = { nome: 'Minidragão: articulações e coleção' };
    const partes = [...Buffer.from(JSON.stringify(esperado))].map((byte) => Buffer.from([byte]));
    await expect(entradaStdin(Readable.from(partes))).resolves.toEqual(esperado);
  });

  it('normaliza apenas os decimais fiscais e mantém códigos e demais campos estritos', () => {
    const esperado = {
      cost: 1.34,
      tax_information: { net_weight: 0.013, gross_weight: 0.023, ncm: '95030039', csosn: '102' },
    };
    const recebido = {
      cost: '1.3400',
      tax_information: {
        net_weight: '0.013',
        gross_weight: '0.0230',
        ncm: '95030039',
        csosn: '102',
      },
    };
    expect(contemCampos(recebido, esperado)).toBe(true);
    expect(contemCampos({ ...recebido, cost: '1.35' }, esperado)).toBe(false);
    expect(contemCampos({ ...recebido, cost: '' }, esperado)).toBe(false);
    expect(
      contemCampos({ tax_information: { csosn: 102 } }, { tax_information: { csosn: '102' } }),
    ).toBe(false);
    expect(
      contemCampos(
        { tax_information: { ncm: 95030039 } },
        { tax_information: { ncm: '95030039' } },
      ),
    ).toBe(false);
    expect(contemCampos({ available_quantity: '20' }, { available_quantity: 20 })).toBe(false);
  });

  it('diagnóstico mostra regra local ou causas sanitizadas sem propagar erro desconhecido', () => {
    const local = new PublicacaoErro('Preço divergente.');
    local.chave = 'DRAG';
    expect(formatarErroPublicacao(local)).toMatchObject({
      motivo: 'Preço divergente.',
      chave: 'DRAG',
    });
    const causas = {
      cause: [
        { code: 'item.attributes.missing_required', type: 'error', references: ['attributes'] },
      ],
    };
    const http = new BadGatewayException({
      mercadoLivreStatus: 400,
      mercadoLivreCausas: causas,
      message: 'não repassar mensagem externa',
    });
    expect(formatarErroPublicacao(http)).toMatchObject({
      mercadoLivreStatus: 400,
      mercadoLivreCausas: causas,
    });
    expect(JSON.stringify(formatarErroPublicacao(http))).not.toContain('mensagem externa');
    expect(JSON.stringify(formatarErroPublicacao(new Error('access_token=SEGREDO')))).not.toContain(
      'SEGREDO',
    );
  });
  it('valida todos os itens antes de criar e persiste cores e confirmação final', async () => {
    const entrada = plano();
    entrada.produtos.push(...plano('CAT').produtos);
    const contexto = await preparar(entrada);
    await contexto.service.executar(entrada);
    const chamadas = contexto.post.mock.calls.map(([path]) => path);
    expect(chamadas.slice(0, 3)).toEqual(['/items/validate', '/items/validate', '/items']);
    expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
      'CAT',
      expect.objectContaining({
        status: 'concluido',
        itens: [
          expect.objectContaining({
            itemId: 'MLB1001',
            verificado: true,
            fiscalConfirmado: true,
            descricaoConfirmada: true,
          }),
        ],
      }),
    );
    const salvo = JSON.parse(
      await readFile(join(contexto.diretorio, 'ml-publicacoes', 'teste-estavel.json'), 'utf8'),
    );
    expect(salvo.itens.DRAG.variationIds['DRAG-COR-0']).toBe('8000');
  });

  it('rejeição do segundo validador não cria nem registra anúncio', async () => {
    const entrada = plano();
    entrada.produtos.push(...plano('CAT').produtos);
    const contexto = await preparar(entrada);
    contexto.post.mockResolvedValueOnce({}).mockRejectedValueOnce(new BadGatewayException());
    await expect(contexto.service.executar(entrada)).rejects.toThrow();
    expect(contexto.post.mock.calls.every(([path]) => path === '/items/validate')).toBe(true);
    expect(contexto.repositorio.registrar).not.toHaveBeenCalled();
  });

  it('timeout após criação reconcilia por SKU e nunca repete POST de criação', async () => {
    const contexto = await preparar();
    const original = contexto.post.getMockImplementation()!;
    contexto.post.mockImplementation(async (path, body) => {
      const resposta = await original(path, body);
      if (path === '/items') throw new Error('timeout');
      return resposta;
    });
    await expect(contexto.service.executar(contexto.entrada)).rejects.toThrow('timeout');
    expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
      'DRAG',
      expect.objectContaining({ status: 'indeterminado' }),
    );
    contexto.post.mockImplementation(original);
    await contexto.service.executar({ ...contexto.entrada, modo: 'retomar' });
    expect(contexto.post.mock.calls.filter(([path]) => path === '/items')).toHaveLength(1);
  });

  it('timeout sem anúncio encontrado impede nova tentativa de criação', async () => {
    const contexto = await preparar();
    const original = contexto.post.getMockImplementation()!;
    contexto.post.mockImplementation(async (path, body) => {
      if (path === '/items') throw new Error('timeout');
      return original(path, body);
    });
    await expect(contexto.service.executar(contexto.entrada)).rejects.toThrow('timeout');
    await expect(
      contexto.service.executar({ ...contexto.entrada, modo: 'retomar' }),
    ).rejects.toThrow('indeterminada');
    expect(contexto.post.mock.calls.filter(([path]) => path === '/items')).toHaveLength(1);
  });

  it('retoma descrição sem recriar anúncio e só marca ERP após fiscal', async () => {
    const contexto = await preparar();
    const original = contexto.post.getMockImplementation()!;
    contexto.post.mockImplementation(async (path, body) => {
      if (path.endsWith('/description')) throw new Error('falha descrição');
      return original(path, body);
    });
    await expect(contexto.service.executar(contexto.entrada)).rejects.toThrow('falha descrição');
    expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
      'DRAG',
      expect.objectContaining({ status: 'incompleto' }),
    );
    contexto.post.mockImplementation(original);
    await contexto.service.executar({ ...contexto.entrada, modo: 'retomar' });
    expect(contexto.post.mock.calls.filter(([path]) => path === '/items')).toHaveLength(1);
    expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
      'DRAG',
      expect.objectContaining({ status: 'concluido' }),
    );
  });

  it('preserva o ID mesmo quando a leitura do anúncio encontra divergência', async () => {
    const contexto = await preparar();
    const original = contexto.get.getMockImplementation()!;
    contexto.get.mockImplementation(async (path) =>
      path === '/items/MLB1000?include_attributes=all'
        ? { ...objeto(await original(path)), seller_id: 99 }
        : original(path),
    );
    await expect(contexto.service.executar(contexto.entrada)).rejects.toThrow('propriedade');
    const salvo = JSON.parse(
      await readFile(join(contexto.diretorio, 'ml-publicacoes', 'teste-estavel.json'), 'utf8'),
    );
    expect(salvo.itens.DRAG.itemId).toBe('MLB1000');
    expect(contexto.post.mock.calls.some(([path]) => path.endsWith('/description'))).toBe(false);
  });

  it.each([true, false])(
    'confirma família de 20 unidades antes de marcar anúncio: família igual=%s',
    async (mesmaFamilia) => {
      const entrada = plano('DRAG', 'user_products');
      const contexto = await preparar(entrada);
      if (!mesmaFamilia) {
        const original = contexto.get.getMockImplementation()!;
        contexto.get.mockImplementation(async (path) =>
          path === '/user-products/MLBU1006' ? { family_id: 9999 } : original(path),
        );
        await expect(contexto.service.executar(entrada)).rejects.toThrow('mesma família');
        expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
          'DRAG',
          expect.objectContaining({ status: 'incompleto' }),
        );
        return;
      }
      await contexto.service.executar(entrada);
      expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
        'DRAG',
        expect.objectContaining({
          status: 'concluido',
          itens: expect.arrayContaining([expect.objectContaining({ familyId: '9000' })]),
        }),
      );
      const criacoes = contexto.post.mock.calls.filter(([path]) => path === '/items');
      expect(criacoes).toHaveLength(7);
      expect(
        criacoes.reduce((soma, [, corpo]) => soma + Number(objeto(corpo).available_quantity), 0),
      ).toBe(20);
    },
  );

  it.each(['quantidade', 'preco', 'estoque', 'tag', 'sku'] as const)(
    'bloqueia divergência de %s antes do validador',
    async (tipo) => {
      const contexto = await preparar();
      const item = contexto.entrada.produtos[0]!.itens[0]!;
      if (tipo === 'quantidade') {
        item.skus[0]!.quantidade = 20;
        item.payload.variations![0]!.available_quantity = 20;
      }
      if (tipo === 'preco') item.payload.variations![0]!.price = 30;
      if (tipo === 'estoque')
        contexto.catalogo[0]!.variacoes.forEach((cor) => {
          cor.estoqueGramas = 100;
        });
      if (tipo === 'tag')
        contexto.get.mockResolvedValueOnce({
          id: 42,
          site_id: 'MLB',
          tags: ['user_product_seller'],
        });
      if (tipo === 'sku') item.payload.variations![0]!.attributes[0]!.value_name = 'OUTRO';
      await expect(contexto.service.executar(contexto.entrada)).rejects.toThrow();
      expect(contexto.post).not.toHaveBeenCalled();
    },
  );

  it('SKU anunciado fora do journal bloqueia duplicação', async () => {
    const contexto = await preparar();
    contexto.anuncios.set('MLB999', {
      attributes: [{ id: 'SELLER_SKU', value_name: 'DRAG-COR-0' }],
    });
    await expect(contexto.service.executar(contexto.entrada)).rejects.toThrow('já anunciado');
    expect(contexto.post).not.toHaveBeenCalled();
  });

  it('execucaoId não aceita conteúdo alterado e lock exclui segundo processo', async () => {
    const contexto = await preparar();
    const liberar = await contexto.journal.adquirir();
    await expect(new PublicacaoJournal(contexto.diretorio, '42').adquirir()).rejects.toMatchObject({
      code: 'EEXIST',
    });
    const journal = await contexto.journal.carregar(
      PublicacaoEntradaSchema.parse(contexto.entrada),
    );
    await contexto.journal.salvar(journal);
    await liberar();
    contexto.entrada.produtos[0]!.itens[0]!.descricao += ' Texto alterado.';
    await expect(contexto.service.executar(contexto.entrada)).rejects.toThrow('conteúdo diferente');
  });

  it('erro fiscal 500 nunca vira ausência nem cadastra dados por suposição', async () => {
    const contexto = await preparar();
    const original = contexto.get.getMockImplementation()!;
    contexto.get.mockImplementation(async (path) => {
      if (path.startsWith('/items/fiscal_information/'))
        throw new BadGatewayException({ mercadoLivreStatus: 500 });
      return original(path);
    });
    await expect(contexto.service.executar(contexto.entrada)).rejects.toThrow();
    expect(contexto.post.mock.calls.some(([path]) => path === '/items/fiscal_information')).toBe(
      false,
    );
    expect(contexto.repositorio.registrar).toHaveBeenLastCalledWith(
      'DRAG',
      expect.objectContaining({ status: 'incompleto' }),
    );
  });
});
