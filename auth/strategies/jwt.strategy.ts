import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../../users/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    super({
      // Токен берём из заголовка Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Вызывается Passport после успешной верификации JWT.
   * Возвращаемое значение будет доступно как req.user.
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.authService.validatePayload(payload);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
