import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export type AuthUser = { sub: string; email: string };

/**
 * Extrai o usuário autenticado da request (preenchido por JwtStrategy.validate).
 * Use depois de @UseGuards(JwtAuthGuard). Retorna null se a rota não exige auth
 * (decoradores `@SkipAuth` ou similares quando existirem).
 *
 * @example
 *   foo(@CurrentUser() user: AuthUser) { return this.svc.fazer(user.sub) }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return req.user ?? null;
  },
);
