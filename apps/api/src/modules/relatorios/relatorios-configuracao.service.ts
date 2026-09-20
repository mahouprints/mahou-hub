import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConfiguracaoRelatoriosUpdate } from '@mahou-hub/contracts';
import type { ConfiguracaoRelatorios } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { cifrarSegredo, decifrarSegredo } from './relatorios-segredo';
import { gerarCodigoGoogle } from './google-script';

@Injectable()
export class RelatoriosConfiguracaoService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    return this.publica(await this.prisma.configuracaoRelatorios.findUnique({ where: { id: 1 } }));
  }

  async salvar(entrada: ConfiguracaoRelatoriosUpdate) {
    const atual = await this.prisma.configuracaoRelatorios.findUnique({ where: { id: 1 } });
    const identidadeMudou =
      atual &&
      (atual.emailGoogle !== entrada.emailGoogle ||
        atual.destinatarios.join(',') !== entrada.destinatarios.join(','));
    const webhookUrl = identidadeMudou
      ? null
      : entrada.webhookUrl === undefined
        ? (atual?.webhookUrl ?? null)
        : entrada.webhookUrl;
    if (entrada.ativo && !webhookUrl)
      throw new BadRequestException('Conecte o Google antes de ativar os envios automáticos');
    const segredoCifrado = !atual || identidadeMudou ? cifrarSegredo() : atual.segredoCifrado;
    const data = {
      ...entrada,
      webhookUrl,
      segredoCifrado,
      ...(!atual?.ativo && entrada.ativo ? { ultimoAgendamentoEm: new Date() } : {}),
    };
    const salvo = await this.prisma.configuracaoRelatorios.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    return this.publica(salvo);
  }

  async codigo() {
    let config = await this.prisma.configuracaoRelatorios.findUnique({ where: { id: 1 } });
    if (!config) throw new BadRequestException('Salve a conta Google e os destinatários primeiro');
    let segredo: string;
    try {
      segredo = decifrarSegredo(config.segredoCifrado);
    } catch {
      // Recuperação explícita após rotação de JWT_SECRET: exige reimplantar o Google.
      const segredoCifrado = cifrarSegredo();
      config = await this.prisma.configuracaoRelatorios.update({
        where: { id: 1 },
        data: { segredoCifrado, webhookUrl: null, ativo: false },
      });
      segredo = decifrarSegredo(segredoCifrado);
    }
    return {
      codigo: gerarCodigoGoogle({
        segredo,
        emailGoogle: config.emailGoogle,
        destinatarios: config.destinatarios,
      }),
    };
  }

  private publica(config: ConfiguracaoRelatorios | null) {
    return {
      ativo: config?.ativo ?? false,
      googleConfigurado: Boolean(config?.webhookUrl),
      emailGoogle: config?.emailGoogle ?? null,
      destinatarios: config?.destinatarios ?? [],
      webhookUrl: config?.webhookUrl ?? null,
      horario: '08:00',
      timezone: 'America/Bahia',
    };
  }
}
