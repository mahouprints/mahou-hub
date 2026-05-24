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
import sharp from 'sharp';
import type { OrigemImagem, ProdutoImagem, ProdutoImagemUpdate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaUrlService } from './media-url.service';

/** Limite por arquivo — bate com o multer upstream. 100MB cobre fotos brutas de celular/DSLR. */
const MAX_IMAGEM_BYTES = 100 * 1024 * 1024; // 100MB

/** Mime types aceitos no upload. Tudo é normalizado pra JPG depois do sharp. */
const MIMES_ACEITOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif']);

interface ArquivoEnviado {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Injectable()
export class ImagensService implements OnModuleInit {
  private readonly storageDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrl: MediaUrlService,
    config: ConfigService,
  ) {
    this.storageDir = config.get<string>('STORAGE_DIR') ?? './storage';
  }

  async onModuleInit() {
    await fs.mkdir(this.diretorioProdutos(), { recursive: true });
  }

  /**
   * Processa N arquivos: valida, normaliza pra JPG (max 2000px), salva em
   * `<storage>/produtos/<produtoId>/<imagemId>.jpg` e cria ProdutoImagem.
   *
   * @example service.upload('produto-123', [{ buffer, mimetype, ... }], 'INSPIRACAO')
   */
  async upload(
    produtoId: string,
    arquivos: ArquivoEnviado[],
    origem: OrigemImagem = 'OUTRA',
  ): Promise<ProdutoImagem[]> {
    if (arquivos.length === 0) throw new BadRequestException('Nenhum arquivo enviado');

    const produto = await this.prisma.produto.findUnique({
      where: { id: produtoId },
      select: { id: true },
    });
    if (!produto) throw new NotFoundException(`Produto ${produtoId} não existe`);

    const dirProduto = join(this.diretorioProdutos(), produtoId);
    await fs.mkdir(dirProduto, { recursive: true });

    // Próxima ordem disponível pro produto (append no fim).
    const ultimo = await this.prisma.produtoImagem.findFirst({
      where: { produtoId },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    let proximaOrdem = (ultimo?.ordem ?? -1) + 1;

    const criadas: ProdutoImagem[] = [];
    for (const arq of arquivos) {
      this.validar(arq);
      const imagemId = randomUUID();
      const arquivoRelativo = `produtos/${produtoId}/${imagemId}.jpg`;
      const arquivoAbs = join(this.storageDir, arquivoRelativo);

      // Normaliza tudo pra JPG: tira EXIF, força sRGB, redimensiona se passar
      // de 2000px no maior lado. Resultado fica menor que o original na maioria
      // dos casos sem perda visual perceptível.
      const transformado = await sharp(arq.buffer)
        .rotate() // respeita orientação EXIF antes de descartar
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88, progressive: true, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      await fs.writeFile(arquivoAbs, transformado.data);

      const registro = await this.prisma.produtoImagem.create({
        data: {
          id: imagemId,
          produtoId,
          arquivo: arquivoRelativo,
          origem,
          ordem: proximaOrdem++,
          larguraPx: transformado.info.width,
          alturaPx: transformado.info.height,
          bytes: transformado.info.size,
        },
      });
      criadas.push(this.paraDto(registro));
    }

    return criadas;
  }

  async update(
    produtoId: string,
    imagemId: string,
    data: ProdutoImagemUpdate,
  ): Promise<ProdutoImagem> {
    const existe = await this.prisma.produtoImagem.findFirst({
      where: { id: imagemId, produtoId },
    });
    if (!existe) throw new NotFoundException(`Imagem ${imagemId} não existe`);
    const atualizada = await this.prisma.produtoImagem.update({
      where: { id: imagemId },
      data,
    });
    return this.paraDto(atualizada);
  }

  async remove(produtoId: string, imagemId: string): Promise<{ ok: true }> {
    const imagem = await this.prisma.produtoImagem.findFirst({
      where: { id: imagemId, produtoId },
    });
    if (!imagem) throw new NotFoundException(`Imagem ${imagemId} não existe`);

    // Apaga o registro primeiro: se o filesystem falhar (arquivo já sumiu, etc),
    // não bloqueia a deleção lógica — o orfão pode ser limpo num GC futuro.
    await this.prisma.produtoImagem.delete({ where: { id: imagemId } });
    const arquivoAbs = join(this.storageDir, imagem.arquivo);
    await fs.unlink(arquivoAbs).catch(() => undefined);
    return { ok: true };
  }

  /** Mapeia row do banco pro DTO (resolve URL pública). Reutilizável em produtos.service. */
  paraDto(row: {
    id: string;
    produtoId: string;
    arquivo: string;
    origem: OrigemImagem;
    ordem: number;
    larguraPx: number | null;
    alturaPx: number | null;
    bytes: number | null;
    criadoEm: Date;
  }): ProdutoImagem {
    return {
      id: row.id,
      produtoId: row.produtoId,
      url: this.mediaUrl.publicUrl(row.arquivo),
      origem: row.origem,
      ordem: row.ordem,
      larguraPx: row.larguraPx,
      alturaPx: row.alturaPx,
      bytes: row.bytes,
      criadoEm: row.criadoEm,
    };
  }

  private diretorioProdutos(): string {
    return join(this.storageDir, 'produtos');
  }

  private validar(arq: ArquivoEnviado) {
    if (!MIMES_ACEITOS.has(arq.mimetype)) {
      throw new BadRequestException(
        `Mime '${arq.mimetype}' não aceito; envie jpg, png, webp, heic ou avif`,
      );
    }
    if (arq.size > MAX_IMAGEM_BYTES) {
      throw new BadRequestException(
        `Arquivo '${arq.originalname}' tem ${arq.size}B (limite ${MAX_IMAGEM_BYTES}B)`,
      );
    }
  }
}
