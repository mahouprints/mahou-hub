import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { Papel } from '@prisma/client';

interface TokenPayload {
  sub: string;
  email: string;
  // Ausente em tokens legados → tratado como ADMIN pelos guards.
  papel?: Papel;
}

function tokenFromCookie(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.['mahou_token'] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        tokenFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-only-secret-troque-em-producao',
    });
  }

  validate(payload: TokenPayload): TokenPayload {
    if (!payload?.sub) throw new UnauthorizedException();
    return payload;
  }
}
