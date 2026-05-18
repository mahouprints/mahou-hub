import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Resolve URLs públicas pras imagens armazenadas em STORAGE_DIR.
 * Em prod: `MEDIA_BASE_URL=https://media.mahouprints.com` (Nginx serve direto).
 * Em dev: fallback pra `http://localhost:3000/media` (Nest serve via ServeStatic).
 *
 * Centralizar aqui permite migrar pra Cloudflare R2/S3 depois sem mexer nos
 * services de domínio — basta trocar a implementação desse método.
 */
@Injectable()
export class MediaUrlService {
  private readonly base: string;

  constructor(config: ConfigService) {
    this.base = (config.get<string>('MEDIA_BASE_URL') ?? 'http://localhost:3000/media').replace(
      /\/$/,
      '',
    );
  }

  /** Devolve URL absoluta pra um path relativo dentro de STORAGE_DIR. */
  publicUrl(arquivo: string): string {
    return `${this.base}/${arquivo.replace(/^\/+/, '')}`;
  }
}
