import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';

interface TokenPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, senha: string): Promise<{ token: string; usuarioId: string }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const ok = await argon2.verify(usuario.senhaHash, senha);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const payload: TokenPayload = { sub: usuario.id, email: usuario.email };
    return { token: this.jwt.sign(payload), usuarioId: usuario.id };
  }

  async ensureAdmin(email: string, senhaInicial: string): Promise<void> {
    const existe = await this.prisma.usuario.findUnique({ where: { email } });
    if (existe) return;
    const senhaHash = await argon2.hash(senhaInicial);
    await this.prisma.usuario.create({ data: { email, senhaHash } });
  }

  /**
   * Gera JWT de longa duração pra fluxos automáticos (n8n, scripts).
   * Mesmo payload do login normal — funciona em todos os endpoints protegidos.
   * Sem rastreio/revogação: pra revogar, troque o JWT_SECRET (invalida tudo).
   */
  gerarApiToken(usuarioId: string, email: string, ttlDias: number): { token: string; expiraEm: Date } {
    const payload: TokenPayload = { sub: usuarioId, email };
    const token = this.jwt.sign(payload, { expiresIn: `${ttlDias}d` });
    const expiraEm = new Date(Date.now() + ttlDias * 24 * 60 * 60 * 1000);
    return { token, expiraEm };
  }
}
