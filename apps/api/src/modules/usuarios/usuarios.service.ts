import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { UsuarioCreate } from '@mahou-hub/contracts';
import { PrismaService } from '../../prisma/prisma.service';

// Nunca devolve senhaHash.
const PUBLICO = {
  id: true,
  nome: true,
  login: true,
  email: true,
  papel: true,
  criadoEm: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.usuario.findMany({ orderBy: { criadoEm: 'asc' }, select: PUBLICO });
  }

  async create(data: UsuarioCreate) {
    await this.garantirDisponivel(data.login, data.email);
    const senhaHash = await argon2.hash(data.senha);
    return this.prisma.usuario.create({
      data: {
        nome: data.nome ?? null,
        login: data.login ?? null,
        email: data.email ?? null,
        senhaHash,
        papel: data.papel,
      },
      select: PUBLICO,
    });
  }

  async trocarSenha(id: string, senha: string) {
    const existe = await this.prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException(`Usuário ${id} não existe`);
    await this.prisma.usuario.update({ where: { id }, data: { senhaHash: await argon2.hash(senha) } });
    return { ok: true };
  }

  // login/email são únicos: erro amigável em vez do P2002 cru do Prisma.
  private async garantirDisponivel(login?: string, email?: string) {
    const ors: { login?: string; email?: string }[] = [];
    if (login) ors.push({ login });
    if (email) ors.push({ email });
    if (ors.length === 0) return;
    const conflito = await this.prisma.usuario.findFirst({ where: { OR: ors } });
    if (conflito) throw new BadRequestException('Login ou e-mail já está em uso');
  }
}
