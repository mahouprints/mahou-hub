import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { Prisma } from '@prisma/client';
import type { ReciboCreate, ReciboItemUpdate, ReciboUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaUrlService } from '../imagens/media-url.service';

/** Limite por arquivo. Nota fiscal (PDF) ou foto do recibo — 50MB cobre com folga. */
const MAX_BYTES = 50 * 1024 * 1024;

/** Recibo aceita imagem OU PDF (diferente de ProdutoImagem, que só imagem). Sem sharp: salva bruto. */
const MIMES_ACEITOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/avif',
  'application/pdf',
]);
const EXT_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
};

interface ArquivoEnviado {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

type ReciboComArquivos = Prisma.ReciboGetPayload<{
  include: { arquivos: true; itens: true };
}>;

/** Sempre carregamos anexo e item juntos: a tela de revisão precisa dos dois lado a lado. */
const COM_ANEXOS_E_ITENS = {
  arquivos: { orderBy: { criadoEm: 'asc' } },
  itens: { orderBy: { criadoEm: 'asc' } },
} satisfies Prisma.ReciboInclude;

/**
 * Ligação entre o campo que o Gabriel corrigiu e o nome que a IA usou em
 * `camposIlegiveis`. Corrigir na tela tem que apagar o alerta — senão a nota fica pedindo
 * outra foto pra sempre por um campo que já foi resolvido na mão.
 */
const ALERTA_POR_CAMPO: Record<string, string> = {
  descricaoNota: 'descricaoNota',
  quantidade: 'quantidade',
  unidade: 'unidade',
  valorUnitCentavos: 'valorUnitario',
  valorTotalCentavos: 'valorTotal',
  tipo: 'tipo',
  gramasTotal: 'gramasTotal',
};

@Injectable()
export class RecibosService implements OnModuleInit {
  private readonly storageDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrl: MediaUrlService,
    config: ConfigService,
  ) {
    this.storageDir = config.get<string>('STORAGE_DIR') ?? './storage';
  }

  async onModuleInit() {
    await fs.mkdir(join(this.storageDir, 'recibos'), { recursive: true });
  }

  async list() {
    const recibos = await this.prisma.recibo.findMany({
      orderBy: { data: 'desc' },
      include: COM_ANEXOS_E_ITENS,
    });
    return recibos.map((r) => this.toDto(r));
  }

  async get(id: string) {
    const r = await this.prisma.recibo.findUnique({ where: { id }, include: COM_ANEXOS_E_ITENS });
    if (!r) throw new NotFoundException(`Recibo ${id} não existe`);
    return this.toDto(r);
  }

  async create(data: ReciboCreate) {
    const r = await this.prisma.recibo.create({
      data: {
        data: new Date(data.data),
        fornecedor: data.fornecedor ?? null,
        valorCentavos: data.valorCentavos ?? null,
        observacao: data.observacao ?? null,
      },
      include: COM_ANEXOS_E_ITENS,
    });
    return this.toDto(r);
  }

  /**
   * Correção manual de uma linha na revisão. Além de gravar, tira dos alertas o campo que
   * acabou de ser preenchido.
   */
  async atualizarItem(reciboId: string, itemId: string, data: ReciboItemUpdate) {
    const item = await this.prisma.reciboItem.findFirst({ where: { id: itemId, reciboId } });
    if (!item) throw new NotFoundException(`Item ${itemId} não existe no recibo ${reciboId}`);
    if (item.movimentoRegistrado) {
      throw new BadRequestException(
        'Este item já virou movimento de estoque — corrija pelo histórico do estoque',
      );
    }

    const corrigidos = Object.keys(data)
      .filter((campo) => data[campo as keyof ReciboItemUpdate] !== undefined)
      .map((campo) => ALERTA_POR_CAMPO[campo])
      .filter((alerta): alerta is string => alerta !== undefined);

    await this.prisma.reciboItem.update({
      where: { id: itemId },
      data: {
        ...data,
        camposIlegiveis: item.camposIlegiveis.filter((c) => !corrigidos.includes(c)),
      },
    });
    return this.get(reciboId);
  }

  async update(id: string, data: ReciboUpdate) {
    await this.garantirExiste(id);
    const r = await this.prisma.recibo.update({
      where: { id },
      data: {
        ...(data.data !== undefined ? { data: new Date(data.data) } : {}),
        ...(data.fornecedor !== undefined ? { fornecedor: data.fornecedor } : {}),
        ...(data.valorCentavos !== undefined ? { valorCentavos: data.valorCentavos } : {}),
        ...(data.observacao !== undefined ? { observacao: data.observacao } : {}),
      },
      include: COM_ANEXOS_E_ITENS,
    });
    return this.toDto(r);
  }

  async remove(id: string) {
    const r = await this.prisma.recibo.findUnique({
      where: { id },
      include: { arquivos: true },
    });
    if (!r) throw new NotFoundException(`Recibo ${id} não existe`);
    // Cascade apaga os ReciboArquivo no banco; some os arquivos do disco em best-effort.
    await this.prisma.recibo.delete({ where: { id } });
    await Promise.all(
      r.arquivos.map((a) => fs.unlink(join(this.storageDir, a.arquivo)).catch(() => undefined)),
    );
    return { ok: true };
  }

  async addArquivos(reciboId: string, arquivos: ArquivoEnviado[]) {
    if (arquivos.length === 0) throw new BadRequestException('Nenhum arquivo enviado');
    await this.garantirExiste(reciboId);
    const dir = join(this.storageDir, 'recibos', reciboId);
    await fs.mkdir(dir, { recursive: true });

    for (const arq of arquivos) {
      this.validar(arq);
      const arquivoId = randomUUID();
      const ext = EXT_POR_MIME[arq.mimetype] ?? 'bin';
      const relativo = `recibos/${reciboId}/${arquivoId}.${ext}`;
      await fs.writeFile(join(this.storageDir, relativo), arq.buffer);
      await this.prisma.reciboArquivo.create({
        data: {
          id: arquivoId,
          reciboId,
          arquivo: relativo,
          nomeOriginal: arq.originalname,
          mimeType: arq.mimetype,
          bytes: arq.size,
        },
      });
    }
    return this.get(reciboId);
  }

  async removeArquivo(reciboId: string, arquivoId: string) {
    const a = await this.prisma.reciboArquivo.findFirst({ where: { id: arquivoId, reciboId } });
    if (!a) throw new NotFoundException(`Arquivo ${arquivoId} não existe`);
    await this.prisma.reciboArquivo.delete({ where: { id: arquivoId } });
    await fs.unlink(join(this.storageDir, a.arquivo)).catch(() => undefined);
    return { ok: true };
  }

  private async garantirExiste(id: string) {
    const r = await this.prisma.recibo.findUnique({ where: { id }, select: { id: true } });
    if (!r) throw new NotFoundException(`Recibo ${id} não existe`);
  }

  private validar(arq: ArquivoEnviado) {
    if (!MIMES_ACEITOS.has(arq.mimetype)) {
      throw new BadRequestException(
        `Tipo '${arq.mimetype}' não aceito; envie imagem (jpg/png/webp) ou PDF`,
      );
    }
    if (arq.size > MAX_BYTES) {
      throw new BadRequestException(`Arquivo '${arq.originalname}' excede o limite de 50MB`);
    }
  }

  private toDto(r: ReciboComArquivos) {
    return {
      id: r.id,
      data: r.data,
      fornecedor: r.fornecedor,
      valorCentavos: r.valorCentavos,
      observacao: r.observacao,
      status: r.status,
      extraidoEm: r.extraidoEm,
      confirmadoEm: r.confirmadoEm,
      camposIlegiveis: r.camposIlegiveis,
      itens: r.itens.map((i) => ({
        ...i,
        // Decimal do Prisma não serializa como número no JSON — a UI espera número.
        quantidade: i.quantidade === null ? null : Number(i.quantidade),
      })),
      arquivos: r.arquivos.map((a) => ({
        id: a.id,
        url: this.mediaUrl.publicUrl(a.arquivo),
        nomeOriginal: a.nomeOriginal,
        mimeType: a.mimeType,
        bytes: a.bytes,
        criadoEm: a.criadoEm,
      })),
    };
  }
}
