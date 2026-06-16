import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Restringe a rota a ADMIN. Roda DEPOIS do JwtAuthGuard (no @UseGuards do controller),
 * então `req.user` já está populado. Token legado (papel undefined) = ADMIN, mantendo
 * compat com tokens emitidos antes dos papéis.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<Request>().user as { papel?: string } | undefined;
    if (user?.papel === 'VISUALIZADOR') {
      throw new ForbiddenException('Apenas administradores podem gerenciar usuários');
    }
    return true;
  }
}
