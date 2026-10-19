import type { MercadoLivrePublicacao } from '@mahou-hub/contracts';
import { HttpException } from '@nestjs/common';
import type { MercadoLivreHttpService } from '../mercado-livre-http.service';
import { PublicacaoJournal, type JournalPublicacao, type RegistroItem } from './publicacao-journal';
import {
  conferirPlano,
  InspecaoEntradaSchema,
  PublicacaoEntradaSchema,
  type CatalogoPublicacao,
  type PublicacaoEntrada,
  type PublicacaoItem,
} from './publicacao-schema';
import {
  aptoParaFaturar,
  contemCampos,
  contemVinculo,
  objeto,
  verificarItem,
} from './publicacao-verificacao';
import { PublicacaoErro } from './publicacao-erro';

export interface RepositorioPublicacao {
  carregar(produtoIds: string[]): Promise<CatalogoPublicacao[]>;
  registrar(produtoId: string, publicacao: MercadoLivrePublicacao): Promise<void>;
}
type HttpPublicacao = Pick<MercadoLivreHttpService, 'sellerId' | 'get' | 'post' | 'put'>;

function statusMl(erro: unknown): unknown {
  const resposta =
    erro !== null &&
    typeof erro === 'object' &&
    'getResponse' in erro &&
    typeof erro.getResponse === 'function'
      ? erro.getResponse()
      : {};
  return objeto(resposta).mercadoLivreStatus;
}

/** Publica somente um plano explícito e validado; ex.: executar(JSON de STDIN). */
export class PublicacaoService {
  constructor(
    private readonly http: HttpPublicacao,
    private readonly repositorio: RepositorioPublicacao,
    private readonly journal: PublicacaoJournal,
  ) {}

  /** Inspeciona metadados da loja e catálogo, sem devolver dados pessoais da conta. */
  async inspecionar(bruto: unknown) {
    const entrada = InspecaoEntradaSchema.parse(bruto);
    const conta = objeto(await this.http.get(`/users/${this.http.sellerId}`));
    const produtos = await this.repositorio.carregar(entrada.produtoIds);
    const categorias = await Promise.all(
      entrada.categorias.map(async (id) => ({
        id,
        categoria: await this.consultaOpcional(`/categories/${id}`),
        atributos: await this.consultaOpcional(`/categories/${id}/attributes`),
        termos: await this.consultaOpcional(`/categories/${id}/sale_terms`),
      })),
    );
    const existentes = await Promise.all(
      entrada.skus.map(async (sku) => ({ sku, itens: await this.buscarSku(sku) })),
    );
    const fiscais = await Promise.all(
      entrada.fiscaisSkus.map(async (sku) => ({ sku, cadastro: await this.lerFiscal(sku) })),
    );
    return {
      conta: { id: conta.id, site_id: conta.site_id, tags: conta.tags },
      produtos,
      categorias,
      existentes,
      fiscais,
    };
  }

  /** Valida todo o lote antes da primeira criação e nunca repete POST /items incerto. */
  async executar(bruto: unknown) {
    const entrada = PublicacaoEntradaSchema.parse(bruto);
    const liberar = await this.journal.adquirir();
    try {
      return await this.executarComLock(entrada);
    } finally {
      await liberar();
    }
  }

  private async executarComLock(entrada: PublicacaoEntrada) {
    const conta = objeto(await this.http.get(`/users/${this.http.sellerId}`));
    if (String(conta.id) !== this.http.sellerId || conta.site_id !== 'MLB')
      throw new PublicacaoErro('Conta Mercado Livre divergente.');
    const catalogo = await this.repositorio.carregar(
      entrada.produtos.map((produto) => produto.produtoId),
    );
    conferirPlano(
      entrada,
      catalogo,
      Array.isArray(conta.tags) && conta.tags.includes('user_product_seller'),
    );
    const journal = await this.journal.carregar(entrada);
    for (const item of entrada.produtos.flatMap((produto) => produto.itens))
      await this.comContexto(item.chave, () => this.validarItem(item, journal));
    if (entrada.modo === 'validar') return { validado: true, execucaoId: entrada.execucaoId };
    const familiasConfirmadas = new Set<string>();
    try {
      for (const produto of entrada.produtos) {
        for (const item of produto.itens)
          await this.comContexto(item.chave, () => this.publicarItem(item, journal, entrada.modo));
        if (entrada.modelo === 'user_products') await this.conferirFamilia(produto, journal);
        familiasConfirmadas.add(produto.produtoId);
        await this.salvarProduto(produto, journal, true);
      }
    } catch (erro) {
      for (const produto of entrada.produtos)
        await this.salvarProduto(produto, journal, familiasConfirmadas.has(produto.produtoId));
      throw erro;
    }
    return { execucaoId: entrada.execucaoId, itens: journal.itens };
  }

  private async validarItem(item: PublicacaoItem, journal: JournalPublicacao): Promise<void> {
    const ids = new Set(
      (await Promise.all(item.skus.map((cor) => this.buscarSku(cor.sku)))).flat(),
    );
    const salvo = journal.itens[item.chave];
    if (!salvo && ids.size > 0)
      throw new PublicacaoErro('SKU já anunciado fora desta execução; reconciliação necessária.');
    if (salvo?.itemId && [...ids].some((id) => id !== salvo.itemId))
      throw new PublicacaoErro('SKU duplicado em outros anúncios.');
    // Um item criado já foi validado antes do POST; retomada não recria nem revalida sua oferta.
    if (salvo) return;
    const resposta = objeto(await this.http.post('/items/validate', item.payload));
    if (
      Array.isArray(resposta.cause) &&
      resposta.cause.some((causa) => objeto(causa).type === 'error')
    )
      throw new PublicacaoErro('Validação ML recusou o plano.');
  }

  private async publicarItem(
    item: PublicacaoItem,
    journal: JournalPublicacao,
    modo: PublicacaoEntrada['modo'],
  ): Promise<void> {
    let salvo = journal.itens[item.chave];
    if (salvo?.estado === 'INTENCAO') salvo = await this.reconciliar(item, journal);
    if (!salvo) {
      if (modo === 'retomar')
        throw new PublicacaoErro('Retomada não cria itens ainda não iniciados.');
      journal.itens[item.chave] = { estado: 'INTENCAO' };
      await this.journal.salvar(journal);
      const criado = objeto(await this.http.post('/items', item.payload));
      if (!/^MLB\d+$/.test(String(criado.id)))
        throw new PublicacaoErro('Criação sem ID confirmado; reconciliar antes de continuar.');
      salvo = { estado: 'CRIADO', itemId: String(criado.id) };
      journal.itens[item.chave] = salvo;
      await this.journal.salvar(journal);
    }
    salvo.verificado = false;
    await this.journal.salvar(journal);
    const remoto = await this.http.get(`/items/${salvo.itemId}?include_attributes=all`);
    Object.assign(salvo, verificarItem(remoto, item, this.http.sellerId));
    await this.journal.salvar(journal);
    await this.concluirDescricao(item, salvo);
    await this.journal.salvar(journal);
    await this.concluirFiscal(item, salvo);
    await this.journal.salvar(journal);
    const final = objeto(await this.http.get(`/items/${salvo.itemId}?include_attributes=all`));
    verificarItem(final, item, this.http.sellerId);
    if (final.status !== 'active')
      throw new PublicacaoErro('Anúncio criado, mas ainda não está ativo.');
    salvo.verificado = true;
    await this.journal.salvar(journal);
  }

  private async reconciliar(
    item: PublicacaoItem,
    journal: JournalPublicacao,
  ): Promise<RegistroItem> {
    const idsPorSku = await Promise.all(item.skus.map((cor) => this.buscarSku(cor.sku)));
    const ids = [...new Set(idsPorSku.flat())];
    if (ids.length !== 1 || idsPorSku.some((itens) => itens.length !== 1))
      throw new PublicacaoErro(
        'Criação indeterminada; nenhum novo anúncio será criado nesta execução.',
      );
    const salvo = verificarItem(
      await this.http.get(`/items/${ids[0]}?include_attributes=all`),
      item,
      this.http.sellerId,
    );
    journal.itens[item.chave] = salvo;
    await this.journal.salvar(journal);
    return salvo;
  }

  private async concluirDescricao(item: PublicacaoItem, salvo: RegistroItem): Promise<void> {
    const path = `/items/${salvo.itemId}/description`;
    const existente = await this.lerOuAusente(path);
    if (objeto(existente).plain_text !== item.descricao) {
      if (existente)
        throw new PublicacaoErro(
          'Descrição existente diverge; revisão necessária antes de substituir.',
        );
      await this.http.post(path, { plain_text: item.descricao });
    }
    if (objeto(await this.http.get(path)).plain_text !== item.descricao)
      throw new PublicacaoErro('Descrição não confirmada no anúncio.');
    salvo.descricaoConfirmada = true;
  }

  private async concluirFiscal(item: PublicacaoItem, salvo: RegistroItem): Promise<void> {
    for (const fiscal of item.fiscais) {
      const existente = await this.lerFiscal(fiscal.sku);
      if (existente && !contemCampos(existente, fiscal.cadastro))
        throw new PublicacaoErro('Cadastro fiscal existente diverge; revisão necessária.');
      if (!existente) await this.http.post('/items/fiscal_information', fiscal.cadastro);
      if (!contemCampos(await this.lerFiscal(fiscal.sku), fiscal.cadastro))
        throw new PublicacaoErro('Cadastro fiscal não confirmado.');
      const variationId = salvo.variationIds?.[fiscal.sku];
      const detalhe = await this.lerOuAusente(`/items/${salvo.itemId}/fiscal_information/detail`);
      if (!contemVinculo(detalhe, fiscal.sku, variationId))
        await this.http.post('/items/fiscal_information/items', {
          sku: fiscal.sku,
          item_id: salvo.itemId,
          ...(variationId ? { variation_id: variationId } : {}),
        });
      if (
        !contemVinculo(
          await this.http.get(`/items/${salvo.itemId}/fiscal_information/detail`),
          fiscal.sku,
          variationId,
        )
      )
        throw new PublicacaoErro('Vínculo fiscal não confirmado.');
    }
    if (
      !aptoParaFaturar(
        await this.http.get(`/can_invoice/items/${salvo.itemId}`),
        salvo.itemId!,
        this.http.sellerId,
      )
    )
      throw new PublicacaoErro('ML ainda não confirmou aptidão fiscal de todas as cores.');
    salvo.fiscalConfirmado = true;
  }

  private async conferirFamilia(
    produto: PublicacaoEntrada['produtos'][number],
    journal: JournalPublicacao,
  ): Promise<void> {
    const familias = new Set<string>();
    const userProducts = new Set<string>();
    for (const item of produto.itens) {
      const salvo = journal.itens[item.chave];
      if (!salvo?.userProductId || !/^MLBU\d+$/.test(salvo.userProductId))
        throw new PublicacaoErro('Item sem User Product confirmado.');
      const remoto = objeto(await this.http.get(`/user-products/${salvo.userProductId}`));
      if (typeof remoto.family_id === 'number' && !Number.isSafeInteger(remoto.family_id))
        throw new PublicacaoErro(
          'Família retornada sem precisão numérica; confirmação interrompida.',
        );
      const familia = String(remoto.family_id ?? '');
      if (!/^\d+$/.test(familia))
        throw new PublicacaoErro('Família do User Product ainda não confirmada.');
      salvo.familyId = familia;
      familias.add(familia);
      userProducts.add(salvo.userProductId);
      await this.journal.salvar(journal);
    }
    if (familias.size !== 1 || userProducts.size !== produto.itens.length)
      throw new PublicacaoErro(
        'As sete cores não pertencem a User Products distintos na mesma família.',
      );
  }

  private async salvarProduto(
    produto: PublicacaoEntrada['produtos'][number],
    journal: JournalPublicacao,
    familiaConfirmada: boolean,
  ): Promise<void> {
    const itens = produto.itens.flatMap((item) => {
      const salvo = journal.itens[item.chave];
      if (!salvo?.itemId) return [];
      const { estado: _estado, ...registro } = salvo;
      return [
        {
          ...registro,
          chave: item.chave,
          itemId: salvo.itemId,
          skus: item.skus.map((cor) => cor.sku),
          descricaoConfirmada: salvo.descricaoConfirmada === true,
          fiscalConfirmado: salvo.fiscalConfirmado === true,
          verificado: salvo.verificado === true,
        },
      ];
    });
    const indeterminado = produto.itens.some(
      (item) => journal.itens[item.chave]?.estado === 'INTENCAO',
    );
    const concluido =
      familiaConfirmada &&
      itens.length === produto.itens.length &&
      itens.every((item) => item.verificado && item.descricaoConfirmada && item.fiscalConfirmado);
    await this.repositorio.registrar(produto.produtoId, {
      versao: 1,
      execucaoId: journal.execucaoId,
      status: indeterminado ? 'indeterminado' : concluido ? 'concluido' : 'incompleto',
      itens,
      atualizadoEm: new Date().toISOString(),
    });
  }

  private async buscarSku(sku: string): Promise<string[]> {
    const query = new URLSearchParams({ seller_sku: sku, limit: '100' });
    const resposta = objeto(
      await this.http.get(`/users/${this.http.sellerId}/items/search?${query}`),
    );
    if (
      !Array.isArray(resposta.results) ||
      Number(objeto(resposta.paging).total ?? resposta.results.length) !==
        resposta.results.length ||
      resposta.results.some((id) => !/^MLB\d+$/.test(String(id)))
    )
      throw new PublicacaoErro('Busca de SKU incompleta.');
    return resposta.results.map(String);
  }

  private async lerOuAusente(path: string): Promise<unknown | null> {
    try {
      return await this.http.get(path);
    } catch (erro) {
      if (statusMl(erro) === 404) return null;
      throw erro;
    }
  }

  private async lerFiscal(sku: string): Promise<unknown | null> {
    const bruto = await this.lerOuAusente(`/items/fiscal_information/${encodeURIComponent(sku)}`);
    if (bruto === null) return null;
    const fiscal = objeto(bruto);
    return Object.fromEntries(
      ['sku', 'title', 'type', 'measurement_unit', 'cost', 'tax_information']
        .filter((campo) => campo in fiscal)
        .map((campo) => [campo, fiscal[campo]]),
    );
  }

  private async comContexto(chave: string, operacao: () => Promise<void>): Promise<void> {
    try {
      await operacao();
    } catch (erro) {
      if (erro instanceof PublicacaoErro) erro.chave = chave;
      if (erro instanceof HttpException)
        throw new HttpException(
          { ...objeto(erro.getResponse()), publicacaoChave: chave },
          erro.getStatus(),
        );
      throw erro;
    }
  }

  private async consultaOpcional(path: string): Promise<unknown> {
    try {
      return await this.http.get(path);
    } catch (erro) {
      return { indisponivel: true, status: statusMl(erro) ?? null };
    }
  }
}
