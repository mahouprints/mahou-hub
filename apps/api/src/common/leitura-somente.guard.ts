import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

const METODOS_LEITURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard global: bloqueia QUALQUER mutação (não-GET) para usuários VISUALIZADOR.
 * Verifica o JWT por conta própria (cookie ou Bearer) pra não depender da ordem
 * do JwtAuthGuard por-controller. Sem token, token inválido ou ADMIN → libera, e
 * o JwtAuthGuard do controller faz a autenticação de verdade. Token legado (sem
 * papel) também passa, mantendo o comportamento de admin de antes dos papéis.
 */
@Injectable()
export class LeituraSomenteGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (METODOS_LEITURA.has(req.method)) return true;

    if (this.papelDoToken(req) === 'VISUALIZADOR') {
      throw new ForbiddenException('Perfil somente leitura: não é possível alterar dados');
    }
    return true;
  }

  private papelDoToken(req: Request): string | undefined {
    const token = this.extrairToken(req);
    if (!token) return undefined;
    try {
      return this.jwt.verify<{ papel?: string }>(token).papel;
    } catch {
      return undefined;
    }
  }

  private extrairToken(req: Request): string | null {
    const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.['mahou_token'];
    if (cookie) return cookie;
    const auth = req.headers.authorization;
    return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  }
}
