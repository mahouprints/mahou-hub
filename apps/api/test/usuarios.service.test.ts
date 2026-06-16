import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsuariosService } from '../src/modules/usuarios/usuarios.service';
import { asPrisma, makePrismaMock } from './helpers/prisma-mock';

vi.mock('argon2', () => ({ hash: vi.fn().mockResolvedValue('hash-fake'), verify: vi.fn() }));

describe('UsuariosService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria usuário com senha hasheada quando não há conflito', async () => {
    const { mock } = makePrismaMock();
    mock.usuario.findFirst.mockResolvedValue(null);
    mock.usuario.create.mockResolvedValue({
      id: 'u2',
      nome: 'Roni',
      login: 'roniberger',
      email: null,
      papel: 'VISUALIZADOR',
      criadoEm: new Date(),
    });
    const svc = new UsuariosService(asPrisma(mock));

    await svc.create({
      nome: 'Roni',
      login: 'roniberger',
      senha: 'senhaTeste123',
      papel: 'VISUALIZADOR',
    });

    expect(mock.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          login: 'roniberger',
          senhaHash: 'hash-fake',
          papel: 'VISUALIZADOR',
        }),
      }),
    );
  });

  it('login/e-mail já em uso → BadRequest', async () => {
    const { mock } = makePrismaMock();
    mock.usuario.findFirst.mockResolvedValue({ id: 'existente' });
    const svc = new UsuariosService(asPrisma(mock));

    await expect(
      svc.create({ login: 'roniberger', senha: 'senhaTeste123', papel: 'VISUALIZADOR' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mock.usuario.create).not.toHaveBeenCalled();
  });

  it('trocarSenha de usuário inexistente → NotFound', async () => {
    const { mock } = makePrismaMock();
    mock.usuario.findUnique.mockResolvedValue(null);
    const svc = new UsuariosService(asPrisma(mock));

    await expect(svc.trocarSenha('nope', 'novaSenha1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('trocarSenha grava o hash da nova senha', async () => {
    const { mock } = makePrismaMock();
    mock.usuario.findUnique.mockResolvedValue({ id: 'u1' });
    mock.usuario.update.mockResolvedValue({});
    const svc = new UsuariosService(asPrisma(mock));

    const res = await svc.trocarSenha('u1', 'novaSenha1');

    expect(mock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { senhaHash: 'hash-fake' },
    });
    expect(res).toEqual({ ok: true });
  });
});
