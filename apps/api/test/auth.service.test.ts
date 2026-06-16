import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/modules/auth/auth.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

vi.mock('argon2', () => ({ verify: vi.fn(), hash: vi.fn().mockResolvedValue('hash-fake') }));
import * as argon2 from 'argon2';

function jwtMock() {
  return { sign: vi.fn().mockReturnValue('tok') } as unknown as JwtService;
}

describe('AuthService.login — por e-mail ou username', () => {
  beforeEach(() => vi.clearAllMocks());

  it('acha por e-mail OU login e assina o token com o papel', async () => {
    const { mock } = makePrismaMock();
    mock.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      email: null,
      login: 'roniberger',
      senhaHash: 'h',
      papel: 'VISUALIZADOR',
    });
    vi.mocked(argon2.verify).mockResolvedValue(true);
    const jwt = jwtMock();
    const svc = new AuthService(asPrisma(mock), jwt);

    const res = await svc.login('roniberger', 'senhaTeste123');

    expect(mock.usuario.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: 'roniberger' }, { login: 'roniberger' }] },
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', papel: 'VISUALIZADOR' }),
    );
    expect(res).toEqual({ token: 'tok', usuarioId: 'u1' });
  });

  it('senha errada → Unauthorized', async () => {
    const { mock } = makePrismaMock();
    mock.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      login: null,
      senhaHash: 'h',
      papel: 'ADMIN',
    });
    vi.mocked(argon2.verify).mockResolvedValue(false);
    const svc = new AuthService(asPrisma(mock), jwtMock());

    await expect(svc.login('a@b.com', 'errada123')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('usuário inexistente → Unauthorized', async () => {
    const { mock } = makePrismaMock();
    mock.usuario.findFirst.mockResolvedValue(null);
    const svc = new AuthService(asPrisma(mock), jwtMock());

    await expect(svc.login('xxx', 'senha1234')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
