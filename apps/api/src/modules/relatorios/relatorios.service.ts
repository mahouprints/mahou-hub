import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, type ConfiguracaoRelatorios, type EnvioRelatorio } from '@prisma/client';
import type { RelatorioFinanceiroQuery } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { definirPeriodoFinanceiro } from '../financeiro/financeiro-periodo';
import { relatoriosVencidos } from './relatorios-agenda';
import { enviarAoGoogle } from './relatorios-google';

@Injectable()
export class RelatoriosService {
  private readonly logger = new Logger(RelatoriosService.name);
  private agendando = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
  ) {}

  async listar() {
    const envios = await this.prisma.envioRelatorio.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 100,
    });
    return envios.map((envio) => this.publico(envio));
  }

  async enviar(entrada: RelatorioFinanceiroQuery) {
    const config = await this.configurada();
    const envio = await this.preparar(entrada, config);
    if (envio.status === 'ENVIADO') return this.publico(envio);
    // A planilha pode demorar minutos: responder já evita timeout do proxy/browser.
    void this.processar(envio, config, true).catch(() =>
      this.logger.error('Envio interrompido; a fila persistida permite retomar'),
    );
    return this.publico({ ...envio, status: 'PROCESSANDO', erro: null });
  }

  @Cron('* * * * *', { timeZone: 'America/Bahia' })
  async agendar() {
    if (this.agendando) return;
    this.agendando = true;
    try {
      const config = await this.prisma.configuracaoRelatorios.findUnique({ where: { id: 1 } });
      if (!config?.webhookUrl) return;
      const agora = new Date();
      if (config.ativo) {
        for (const entrada of relatoriosVencidos(agora, config.ultimoAgendamentoEm))
          await this.preparar(entrada, config);
        await this.prisma.configuracaoRelatorios.updateMany({
          where: { id: 1, ativo: true, atualizadoEm: config.atualizadoEm },
          data: { ultimoAgendamentoEm: agora },
        });
      }
      await this.retomar(config, agora);
    } catch {
      this.logger.error('Falha no agendamento financeiro; será retomado no próximo minuto');
    } finally {
      this.agendando = false;
    }
  }

  private async configurada() {
    const config = await this.prisma.configuracaoRelatorios.findUnique({ where: { id: 1 } });
    if (!config?.webhookUrl)
      throw new BadRequestException('Conecte a conta Google antes de enviar');
    return config;
  }

  private async preparar(entrada: RelatorioFinanceiroQuery, config: ConfiguracaoRelatorios) {
    const { periodo, inicio, fim } = definirPeriodoFinanceiro(entrada);
    const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    if (inicio > hoje) throw new BadRequestException('Escolha um período já iniciado');
    const previa = fim >= hoje;
    const chave = `${periodo}:${inicio}:${fim}${previa ? `:PREVIA:${hoje}` : ''}`;
    const existente = await this.prisma.envioRelatorio.findUnique({ where: { chave } });
    if (existente) return existente;
    const relatorio = await this.financeiro.relatorio(entrada);
    if (previa) relatorio.titulo += ` — Prévia de ${hoje.split('-').reverse().join('/')}`;
    return this.prisma.envioRelatorio.upsert({
      where: { chave },
      update: {},
      create: {
        chave,
        periodo,
        inicio,
        fim,
        destinatarios: config.destinatarios,
        relatorio: relatorio as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async retomar(config: ConfiguracaoRelatorios, agora: Date) {
    await this.prisma.envioRelatorio.updateMany({
      where: {
        status: 'PROCESSANDO',
        tentativas: { gte: 5 },
        processamentoEm: { lt: new Date(agora.getTime() - 10 * 60000) },
      },
      data: {
        status: 'FALHOU',
        erro: 'O processamento foi interrompido na última tentativa. Solicite novamente para conferir o envio com o Google.',
      },
    });
    const envios = await this.prisma.envioRelatorio.findMany({
      where: {
        tentativas: { lt: 5 },
        proximaTentativaEm: { lte: agora },
        OR: [
          { status: { in: ['PENDENTE', 'FALHOU'] } },
          {
            status: 'PROCESSANDO',
            processamentoEm: { lt: new Date(agora.getTime() - 10 * 60000) },
          },
        ],
      },
      orderBy: { criadoEm: 'asc' },
      take: 3,
    });
    for (const envio of envios) await this.processar(envio, config);
  }

  private async processar(envio: EnvioRelatorio, config: ConfiguracaoRelatorios, manual = false) {
    const agora = new Date();
    const claim = await this.prisma.envioRelatorio.updateMany({
      where: {
        id: envio.id,
        ...(manual ? {} : { tentativas: { lt: 5 } }),
        OR: [
          { status: { in: ['PENDENTE', 'FALHOU'] } },
          {
            status: 'PROCESSANDO',
            processamentoEm: { lt: new Date(agora.getTime() - 10 * 60000) },
          },
        ],
      },
      data: {
        status: 'PROCESSANDO',
        processamentoEm: agora,
        tentativas: { increment: 1 },
        erro: null,
      },
    });
    if (!claim.count) return;
    try {
      if (envio.destinatarios.join(',') !== config.destinatarios.join(','))
        throw new Error('Os destinatários mudaram após a preparação deste relatório');
      const resultado = await enviarAoGoogle(config, envio);
      await this.prisma.envioRelatorio.update({
        where: { id: envio.id },
        data: {
          status: 'ENVIADO',
          planilhaUrl: resultado.planilhaUrl,
          enviadoEm: resultado.enviadoEm,
        },
      });
    } catch (erro) {
      await this.prisma.envioRelatorio.update({
        where: { id: envio.id },
        data: {
          status: 'FALHOU',
          erro: erro instanceof Error ? erro.message.slice(0, 400) : 'Falha no envio',
          proximaTentativaEm: new Date(
            Date.now() + 15 * 60000 * 2 ** Math.min(envio.tentativas, 4),
          ),
        },
      });
    }
  }

  private publico(envio: EnvioRelatorio) {
    const { id, periodo, inicio, fim, status, planilhaUrl, erro, criadoEm, enviadoEm } = envio;
    const titulo = (envio.relatorio as { titulo?: string }).titulo;
    return { id, periodo, inicio, fim, status, planilhaUrl, erro, criadoEm, enviadoEm, titulo };
  }
}
