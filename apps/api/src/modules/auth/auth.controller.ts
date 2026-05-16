import { Body, Controller, Post, Res, UsePipes } from '@nestjs/common';
import type { Response } from 'express';
import { LoginInputSchema, type LoginInput } from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginInputSchema))
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ usuarioId: string; email: string }> {
    const { token, usuarioId } = await this.auth.login(body.email, body.senha);
    res.cookie('mahou_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    return { usuarioId, email: body.email };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie('mahou_token', { path: '/' });
    return { ok: true };
  }
}
