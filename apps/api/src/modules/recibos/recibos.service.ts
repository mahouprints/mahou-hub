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
import type { ReciboCreate, ReciboUpdate } from '@mahou-hub/contracts';
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

type ReciboComArquivos = {
  id: string;
  data: Date;
  fornecedor: string | null;
  valorCentavos: number | null;
  observacao: string | null;
  arquivos: Array<{
    id: string;
    arquivo: string;
    nomeOriginal: string;
    mimeType: string;
    bytes: number;
    criadoEm: Date;
  }>;
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
      include: { arquivos: { orderBy: { criadoEm: 'asc' } } },
    });
    return recibos.map((r) => this.toDto(r));
  }

  async get(id: string) {
    const r = await this.prisma.recibo.findUnique({
      where: { id },
      include: { arquivos: { orderBy: { criadoEm: 'asc' } } },
    });
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
      include: { arquivos: true },
    });
    return this.toDto(r);
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
      include: { arquivos: { orderBy: { criadoEm: 'asc' } } },
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
