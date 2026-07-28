import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AtendimentoService } from './atendimento.service';
import { MercadoLivreClient } from './mercadolivre.client';
import { ShopeeOrdersClient } from './shopee-orders.client';

@Injectable()
export class PedidosSyncService {
  private readonly logger = new Logger(PedidosSyncService.name);

  constructor(
    private readonly atendimento: AtendimentoService,
    private readonly shopee: ShopeeOrdersClient,
    private readonly ml: MercadoLivreClient,
  ) {}

  /**
   * Puxa pedidos novos dos marketplaces configurados.
   *
   * Cada canal é isolado: Shopee fora do ar não pode impedir o ML de importar, senão
   * um pedido some da fila de produção por causa de indisponibilidade do outro lado.
   */
  async sincronizarTudo(horas = 24) {
    const desde = new Date(Date.now() - horas * 3_600_000);
    const resultado = {
      shopee: await this.sincronizarShopee(desde),
      ml: await this.sincronizarMl(desde),
    };
    this.logger.log(
      `Sync pedidos: Shopee ${resultado.shopee.importados} novos, ML ${resultado.ml.importados} novos`,
    );
    return resultado;
  }

  private async sincronizarShopee(desde: Date) {
    if (!this.shopee.estaConfigurado()) {
      return { configurado: false, importados: 0, erros: [] as string[] };
    }
    try {
      const sns = await this.shopee.listarPedidosParaDespachar(desde, new Date());
      const pedidos = await this.shopee.detalharPedidos(sns);
      return await this.importarLista(pedidos, 'SHOPEE');
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      this.logger.error(`Sync Shopee falhou: ${msg}`);
      return { configurado: true, importados: 0, erros: [msg] };
    }
  }

  private async sincronizarMl(desde: Date) {
    if (!this.ml.estaConfigurado()) {
      return { configurado: false, importados: 0, erros: [] as string[] };
    }
    try {
      const pedidos = await this.ml.listarPedidosPagos(desde);
      return await this.importarLista(pedidos, 'ML');
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      this.logger.error(`Sync ML falhou: ${msg}`);
      return { configurado: true, importados: 0, erros: [msg] };
    }
  }

  /** Um pedido problemático não pode derrubar o lote inteiro — erro é acumulado, não propagado. */
  private async importarLista(
    pedidos: Awaited<ReturnType<ShopeeOrdersClient['detalharPedidos']>>,
    canal: string,
  ) {
    let importados = 0;
    const erros: string[] = [];

    for (const pedido of pedidos) {
      try {
        const r = await this.atendimento.importar(pedido);
        if (r.novo) importados++;
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : String(erro);
        erros.push(`${canal}/${pedido.externalId}: ${msg}`);
        this.logger.error(`Importação de ${canal}/${pedido.externalId} falhou: ${msg}`);
      }
    }
    return { configurado: true, importados, erros };
  }

  /**
   * Polling a cada 15 minutos. Não é o caminho ideal — o ML entrega por webhook e a
   * Shopee também suporta push —, mas webhook exige endpoint público registrado nos
   * dois painéis. Enquanto isso não existe, o polling garante que nenhum pedido fique
   * parado esperando alguém apertar um botão.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async cronSincronizar() {
    if (!this.shopee.estaConfigurado() && !this.ml.estaConfigurado()) return;
    await this.sincronizarTudo(2);
  }
}
