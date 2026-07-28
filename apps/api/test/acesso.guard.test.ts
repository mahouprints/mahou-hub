import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { LeituraSomenteGuard } from '../src/common/leitura-somente.guard';
import { AdminGuard } from '../src/common/admin.guard';

function ctx(req: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('LeituraSomenteGuard — bloqueia mutação de VISUALIZADOR', () => {
  const verify = vi.fn();
  const guard = new LeituraSomenteGuard({ verify } as unknown as JwtService);

  it('libera GET sem nem olhar o token', () => {
    verify.mockClear();
    expect(guard.canActivate(ctx({ method: 'GET', headers: {} }))).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('bloqueia POST de VISUALIZADOR', () => {
    verify.mockReturnValue({ papel: 'VISUALIZADOR' });
    expect(() =>
      guard.canActivate(ctx({ method: 'POST', headers: { authorization: 'Bearer t' }, cookies: {} })),
    ).toThrow(ForbiddenException);
  });

  // Regressão (28/jul/2026): o guard barrava POST /auth/login pra quem tinha cookie de
  // VISUALIZADOR. Efeito: quem entrasse com a conta somente-leitura não conseguia logar
  // com outra nem sair — ficava preso até o cookie expirar, e a tela dizia
  // "Credenciais inválidas", mandando caçar erro numa senha que estava certa.
  it('libera login de VISUALIZADOR — senão fica preso na sessão', () => {
    verify.mockReturnValue({ papel: 'VISUALIZADOR' });
    const req = {
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: {},
      cookies: { mahou_token: 't' },
    };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it('libera logout de VISUALIZADOR', () => {
    verify.mockReturnValue({ papel: 'VISUALIZADOR' });
    const req = {
      method: 'POST',
      path: '/api/v1/auth/logout',
      headers: {},
      cookies: { mahou_token: 't' },
    };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  // A isenção vale só pras duas rotas de sessão — não pode virar buraco geral em /auth.
  it('não libera outras rotas de auth pra VISUALIZADOR', () => {
    verify.mockReturnValue({ papel: 'VISUALIZADOR' });
    const req = {
      method: 'POST',
      path: '/api/v1/auth/api-token',
      headers: {},
      cookies: { mahou_token: 't' },
    };
    expect(() => guard.canActivate(ctx(req))).toThrow(ForbiddenException);
  });

  it('libera POST de ADMIN', () => {
    verify.mockReturnValue({ papel: 'ADMIN' });
    expect(
      guard.canActivate(ctx({ method: 'POST', headers: { authorization: 'Bearer t' }, cookies: {} })),
    ).toBe(true);
  });

  it('libera POST sem token (deixa o JwtAuthGuard rejeitar)', () => {
    expect(guard.canActivate(ctx({ method: 'POST', headers: {}, cookies: {} }))).toBe(true);
  });

  it('libera POST com token inválido (verify lança)', () => {
    verify.mockImplementation(() => {
      throw new Error('invalid');
    });
    expect(
      guard.canActivate(ctx({ method: 'POST', headers: { authorization: 'Bearer x' }, cookies: {} })),
    ).toBe(true);
  });
});

describe('AdminGuard — só ADMIN gerencia usuários', () => {
  const guard = new AdminGuard();

  it('libera ADMIN', () => {
    expect(guard.canActivate(ctx({ user: { papel: 'ADMIN' } }))).toBe(true);
  });

  it('libera token legado (sem papel)', () => {
    expect(guard.canActivate(ctx({ user: { sub: 'u1' } }))).toBe(true);
  });

  it('bloqueia VISUALIZADOR', () => {
    expect(() => guard.canActivate(ctx({ user: { papel: 'VISUALIZADOR' } }))).toThrow(
      ForbiddenException,
    );
  });
});
