import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/admin.guard';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';

@Module({
  providers: [UsuariosService, AdminGuard],
  controllers: [UsuariosController],
})
export class UsuariosModule {}
