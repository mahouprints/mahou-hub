import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  TrocarSenhaSchema,
  UsuarioCreateSchema,
  type TrocarSenha,
  type UsuarioCreate,
} from '@mahou-hub/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AdminGuard } from '../../common/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsuariosService } from './usuarios.service';

// Gestão de usuários é só pra ADMIN. JwtAuthGuard autentica; AdminGuard checa o papel.
@ApiTags('usuarios')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @ApiOperation({ summary: 'Cria um usuário (ADMIN ou VISUALIZADOR somente leitura)' })
  create(@Body(new ZodValidationPipe(UsuarioCreateSchema)) data: UsuarioCreate) {
    return this.service.create(data);
  }

  @Patch(':id/senha')
  @ApiOperation({ summary: 'Reseta a senha de um usuário' })
  trocarSenha(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TrocarSenhaSchema)) data: TrocarSenha,
  ) {
    return this.service.trocarSenha(id, data.senha);
  }
}
