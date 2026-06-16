import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Papel } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';

interface TokenPayload {
  sub: string;
  email: string;
  // Ausente em tokens legados (emitidos antes dos papéis) — tratados como ADMIN.
  papel?: Papel;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Autentica por e-mail OU login (username). Ex.: admin usa o e-mail, Roni usa "roniberger". */
  async login(identificador: string, senha: string): Promise<{ token: string; usuarioId: string }> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { OR: [{ email: identificador }, { login: identificador }] },
    });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const ok = await argon2.verify(usuario.senhaHash, senha);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const payload: TokenPayload = {
      sub: usuario.id,
      email: usuario.email ?? usuario.login ?? usuario.id,
      papel: usuario.papel,
    };
    return { token: this.jwt.sign(payload), usuarioId: usuario.id };
  }

  async ensureAdmin(email: string, senhaInicial: string): Promise<void> {
    const existe = await this.prisma.usuario.findUnique({ where: { email } });
    if (existe) return;
    const senhaHash = await argon2.hash(senhaInicial);
    await this.prisma.usuario.create({ data: { email, senhaHash, papel: 'ADMIN' } });
  }

  /**
   * Gera JWT de longa duração pra fluxos automáticos (n8n, scripts).
   * Mesmo payload do login normal (carrega o papel) — funciona em todos os endpoints.
   * Sem rastreio/revogação: pra revogar, troque o JWT_SECRET (invalida tudo).
   */
  gerarApiToken(
    usuarioId: string,
    email: string,
    papel: Papel | undefined,
    ttlDias: number,
  ): { token: string; expiraEm: Date } {
    const payload: TokenPayload = { sub: usuarioId, email, papel };
    const token = this.jwt.sign(payload, { expiresIn: `${ttlDias}d` });
    const expiraEm = new Date(Date.now() + ttlDias * 24 * 60 * 60 * 1000);
    return { token, expiraEm };
  }
}
