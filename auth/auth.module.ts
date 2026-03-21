import { Module } from '@nestjs/common';
import { JwtModule }      from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule }   from '@nestjs/config';
import { APP_GUARD }      from '@nestjs/core';

import { AuthController } from './auth.controller';
import { AuthService }    from './auth.service';
import { JwtStrategy }    from './strategies/jwt.strategy';
import { UsersModule }    from '../users/users.module';
import { JwtAuthGuard }   from '../common/guards/jwt-auth.guard';
import { RolesGuard }     from '../common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule,     // ConfigService должен быть доступен глобально
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Секрет передаётся динамически через ConfigService
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Регистрируем JwtAuthGuard глобально — защищает все роуты
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RolesGuard работает поверх JwtAuthGuard
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
