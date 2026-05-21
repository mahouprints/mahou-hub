import { Body, Controller, Post, Req, Res, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  ApiTokenInputSchema,
  LoginInputSchema,
  type ApiTokenInput,
  type ApiTokenOutput,
  type LoginInput,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login por email/senha',
    description: 'Devolve cookie httpOnly `mahou_token` (7d). Pra fluxos automáticos prefira `/auth/api-token`.',
  })
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
  @ApiOperation({ summary: 'Limpa o cookie de sessão' })
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie('mahou_token', { path: '/' });
    return { ok: true };
  }

  /**
   * Gera token JWT de longa duração pra uso em fluxos externos (n8n, scripts).
   * Resposta é exibida UMA vez na UI — usuário precisa copiar e guardar.
   */
  @Post('api-token')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Gera JWT de longa duração (1..365 dias) pra fluxos externos',
    description:
      'Use em vez do login por cookie quando integrar com n8n, Make, scripts, etc. ' +
      'Token resultante vai no header `Authorization: Bearer <token>`. ' +
      'Não há revogação por token — pra invalidar tudo, rotacione JWT_SECRET no servidor.',
  })
  @UseGuards(JwtAuthGuard)
  apiToken(
    @Req() req: Request,
    @Body(new ZodValidationPipe(ApiTokenInputSchema)) body: ApiTokenInput,
  ): ApiTokenOutput {
    const user = req.user as { sub: string; email: string };
    return this.auth.gerarApiToken(user.sub, user.email, body.ttlDias);
  }
}
