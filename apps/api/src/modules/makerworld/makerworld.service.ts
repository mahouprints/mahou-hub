import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Canal, Prisma } from '@prisma/client';
import type {
  AnuncioModeloUpsert,
  MakerworldBulkImport,
  MakerworldListar,
  MakerworldUpdate,
  ModeloMakerWorldStatus,
} from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';

const ORDENACOES: Record<
  MakerworldListar['ordenarPor'],
  Prisma.ModeloMakerWorldOrderByWithRelationInput[]
> = {
  notaIa: [{ notaIa: 'desc' }, { lucroPorHoraCentavos: 'desc' }],
  scoreObjetivo: [{ scoreObjetivo: 'desc' }],
  lucroPorHora: [{ lucroPorHoraCentavos: 'desc' }],
  downloads: [{ downloads: 'desc' }],
};

@Injectable()
export class MakerworldService {
  private readonly logger = new Logger(MakerworldService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  /**
   * Upsert em lote vindo do bot. Chave é `externalId` — reimportar o mesmo modelo
   * atualiza métricas e nota sem duplicar.
   *
   * `status` e `observacao` NÃO são tocados no update: são a revisão do Gabriel, e uma
   * reimportação não pode desfazer um DESCARTADO que ele já decidiu.
   */
  async importarEmLote(payload: MakerworldBulkImport) {
    let criados = 0;
    let atualizados = 0;

    for (const modelo of payload.modelos) {
      const dados = {
        titulo: modelo.titulo,
        url: modelo.url,
        autor: modelo.autor,
        imagemUrl: modelo.imagemUrl,
        downloads: modelo.downloads,
        curtidas: modelo.curtidas,
        colecoes: modelo.colecoes,
        licenca: modelo.licenca,
        licencaVeredicto: modelo.licencaVeredicto,
        licencaObrigacao: modelo.licencaObrigacao,
        nicho: modelo.nicho,
        pesoGramas: new Prisma.Decimal(modelo.pesoGramas),
        tempoHoras: new Prisma.Decimal(modelo.tempoHoras),
        unidadesPorKit: modelo.unidadesPorKit,
        custoEstimadoCentavos: modelo.custoEstimadoCentavos,
        precoSugeridoCentavos: modelo.precoSugeridoCentavos,
        margemEstimadaPct: new Prisma.Decimal(modelo.margemEstimadaPct),
        lucroPorHoraCentavos: modelo.lucroPorHoraCentavos,
        scoreObjetivo: modelo.scoreObjetivo,
        notaIa: modelo.notaIa,
        veredictoIa: modelo.veredictoIa,
        justificativaIa: modelo.justificativaIa,
        alertas: modelo.alertas,
        tags: modelo.tags,
        temFotoReal: modelo.temFotoReal,
      };

      const existente = await this.prisma.modeloMakerWorld.findUnique({
        where: { externalId: modelo.externalId },
        select: { id: true },
      });

      await this.prisma.modeloMakerWorld.upsert({
        where: { externalId: modelo.externalId },
        create: { externalId: modelo.externalId, ...dados },
        update: dados,
      });

      if (existente) atualizados++;
      else criados++;
    }

    this.logger.log(`Importação MakerWorld: ${criados} criados, ${atualizados} atualizados`);
    return { criados, atualizados, total: payload.modelos.length };
  }

  async listar(filtros: MakerworldListar) {
    const where: Prisma.ModeloMakerWorldWhereInput = {};

    if (filtros.status) where.status = filtros.status;
    if (filtros.nicho) where.nicho = filtros.nicho;
    if (filtros.veredictoIa) where.veredictoIa = filtros.veredictoIa;
    if (filtros.notaMinima !== undefined) where.notaIa = { gte: filtros.notaMinima };
    if (filtros.lucroPorHoraMinimoCentavos !== undefined) {
      where.lucroPorHoraCentavos = { gte: filtros.lucroPorHoraMinimoCentavos };
    }
    if (filtros.semAlertas?.length) {
      where.NOT = { alertas: { hasSome: filtros.semAlertas } };
    }
    if (filtros.q) {
      where.OR = [
        { titulo: { contains: filtros.q, mode: 'insensitive' } },
        { tags: { has: filtros.q.toLowerCase() } },
        { autor: { contains: filtros.q, mode: 'insensitive' } },
      ];
    }

    const [itens, total] = await Promise.all([
      this.prisma.modeloMakerWorld.findMany({
        where,
        orderBy: ORDENACOES[filtros.ordenarPor],
        take: filtros.limit,
        skip: filtros.offset,
      }),
      this.prisma.modeloMakerWorld.count({ where }),
    ]);

    return { itens, total, limit: filtros.limit, offset: filtros.offset };
  }

  async buscarPorId(id: string) {
    const modelo = await this.prisma.modeloMakerWorld.findUnique({ where: { id } });
    if (!modelo) throw new NotFoundException(`Modelo MakerWorld ${id} não encontrado`);
    return modelo;
  }

  /**
   * Modelo + o que a tela de anúncio precisa: economia e plano de ROAS recalculados
   * agora, e a copy já gerada. Economia e ROAS saem pelo canal SHOPEE porque é onde
   * a Mahou anuncia e onde o degrau de taxa decide o preço — os outros canais têm a
   * copy guardada, mas o plano de mídia mostrado é o da Shopee.
   */
  async buscarDetalhe(id: string) {
    const modelo = await this.prisma.modeloMakerWorld.findUnique({
      where: { id },
      include: {
        anuncios: { orderBy: { marketplace: 'asc' } },
        // `produtoId` sozinho não diz se o produto ESTÁ na vitrine: o vínculo continua
        // depois que ele volta pra revisão (é o mesmo produto). A tela precisa dos dois
        // pra não travar no botão "já está na vitrine" com o produto fora dela.
        produto: { select: { naVitrine: true, canaisAnunciados: true } },
      },
    });
    if (!modelo) throw new NotFoundException(`Modelo MakerWorld ${id} não encontrado`);

    const economia = await this.pricing.economiaDeCustoPronto({
      precoCentavos: modelo.precoSugeridoCentavos,
      custoCentavos: modelo.custoEstimadoCentavos,
      canal: 'SHOPEE',
      tempoHoras: Number(modelo.tempoHoras),
    });
    const planoAds = await this.pricing.planoAds({
      precoCentavos: economia.precoCentavos,
      margemContribuicaoCentavos: economia.liquidoCentavos,
    });

    return { ...modelo, economia, planoAds };
  }

  /**
   * Grava a copy que a skill `gerar-descricao` produziu. Regerar o mesmo marketplace
   * sobrescreve e sobe a versão — histórico de copy descartada não serve pra nada,
   * mas saber que já foi refeita 3 vezes serve.
   */
  async salvarAnuncio(modeloId: string, dados: AnuncioModeloUpsert) {
    await this.buscarPorId(modeloId);
    const chave = { modeloId_marketplace: { modeloId, marketplace: dados.marketplace } };
    const atual = await this.prisma.anuncioModelo.findUnique({ where: chave });

    return this.prisma.anuncioModelo.upsert({
      where: chave,
      create: { modeloId, ...dados },
      update: { ...dados, versao: (atual?.versao ?? 0) + 1, geradoEm: new Date() },
    });
  }

  /**
   * "Anunciei este" — o modelo vira Produto de verdade e entra na Vitrine.
   *
   * Só a partir daqui existem venda e estoque: modelo de prospecção não tem nem um
   * nem outro, quem tem é Produto (via Venda e ProdutoVariacao). O nome sai do título
   * do anúncio Shopee quando já foi gerado, porque é o nome sob o qual o produto está
   * de fato à venda — o título do MakerWorld está em inglês.
   *
   * Chamar de novo num modelo já convertido não duplica: só regarante as flags.
   */
  async marcarAnunciado(id: string, canais: Canal[] = []) {
    const modelo = await this.prisma.modeloMakerWorld.findUnique({
      where: { id },
      include: { anuncios: { where: { marketplace: 'SHOPEE' } } },
    });
    if (!modelo) throw new NotFoundException(`Modelo MakerWorld ${id} não encontrado`);

    if (modelo.produtoId) {
      // Produto que já existe: pode ser reanúncio depois de ter voltado pra revisão. O
      // status do modelo volta junto, senão ele fica na vitrine e em "Favoritos" ao mesmo
      // tempo — dois lugares dizendo coisas diferentes sobre o mesmo produto.
      return this.prisma.$transaction(async (tx) => {
        await tx.modeloMakerWorld.update({ where: { id }, data: { status: 'VIROU_PRODUTO' } });
        return tx.produto.update({
          where: { id: modelo.produtoId! },
          data: { ...this.flagsDeAnuncio(canais), naVitrine: true },
        });
      });
    }

    // O filamento não vem do MakerWorld — o modelo é um arquivo, não uma peça nossa.
    // Pega o primeiro ativo pro custo sair de algum lugar; o Gabriel corrige depois.
    const filamento = await this.prisma.filamento.findFirst({
      where: { ativo: true },
      select: { id: true },
      orderBy: { criadoEm: 'asc' },
    });
    if (!filamento) {
      throw new BadRequestException(
        'Nenhum filamento ativo cadastrado — cadastre um antes de mandar produto pra vitrine',
      );
    }

    const anuncio = modelo.anuncios[0];

    return this.prisma.$transaction(async (tx) => {
      const produto = await tx.produto.create({
        data: {
          nome: (anuncio?.titulo ?? modelo.titulo).slice(0, 200),
          inspiracao: modelo.url,
          filamentoId: filamento.id,
          pesoG: modelo.pesoGramas,
          tempoH: modelo.tempoHoras,
          impressora: 'A1',
          embalagemCentavos: 0,
          precoCentavos: anuncio?.precoBaseCentavos ?? modelo.precoSugeridoCentavos,
          canalPrincipal: 'SHOPEE',
          rascunho: false,
          ativo: true,
          ...this.flagsDeAnuncio(canais),
          naVitrine: true,
        },
      });
      await tx.modeloMakerWorld.update({
        where: { id },
        data: { status: 'VIROU_PRODUTO', produtoId: produto.id },
      });
      this.logger.log(`Modelo ${id} virou Produto ${produto.id} e entrou na vitrine`);
      return produto;
    });
  }

  /**
   * Onde o produto foi anunciado + a flag booleana que o fluxo externo de imagem lê.
   * Lista vazia ainda marca `anunciado`: o Gabriel disse que anunciou, só não disse onde
   * — tratar como "não anunciado" jogaria o produto de volta na fila de geração de foto.
   */
  private flagsDeAnuncio(canais: Canal[]) {
    return { anunciado: true, canaisAnunciados: [...new Set(canais)] };
  }

  async atualizar(id: string, dados: MakerworldUpdate) {
    await this.buscarPorId(id);
    return this.prisma.modeloMakerWorld.update({ where: { id }, data: dados });
  }

  async mudarStatusEmLote(ids: string[], status: ModeloMakerWorldStatus) {
    const { count } = await this.prisma.modeloMakerWorld.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    return { atualizados: count };
  }

  /** Contagem por nicho e por status — alimenta os cards da tela de revisão. */
  async resumo() {
    const [porNicho, porStatus, total] = await Promise.all([
      this.prisma.modeloMakerWorld.groupBy({
        by: ['nicho'],
        _count: { _all: true },
        _avg: { notaIa: true },
        orderBy: { _count: { nicho: 'desc' } },
      }),
      this.prisma.modeloMakerWorld.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.modeloMakerWorld.count(),
    ]);

    return {
      total,
      porNicho: porNicho.map((n) => ({
        nicho: n.nicho,
        quantidade: n._count._all,
        notaMedia: Math.round(n._avg.notaIa ?? 0),
      })),
      porStatus: porStatus.map((s) => ({ status: s.status, quantidade: s._count._all })),
    };
  }
}
