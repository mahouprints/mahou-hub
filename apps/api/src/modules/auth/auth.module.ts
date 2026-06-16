import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { LeituraSomenteGuard } from '../../common/leitura-somente.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'dev-only-secret-troque-em-producao',
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
      }),
    }),
  ],
  // LeituraSomenteGuard é global (APP_GUARD) mas declarado aqui pra injetar o JwtService
  // configurado neste módulo. Bloqueia mutações de usuários VISUALIZADOR em toda a API.
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: LeituraSomenteGuard },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
