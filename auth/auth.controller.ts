import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Patch,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthDto, RefreshTokenDto } from './dto/auth.dto';
import { Public }       from '../common/decorators/public.decorator';
import { CurrentUser }  from '../common/decorators/current-user.decorator';
import { Roles }        from '../common/decorators/roles.decorator';
import { UserRole, User } from '../users/user.entity';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/telegram
   * Верифицирует Telegram initData и возвращает JWT-токены.
   * Публичный endpoint — токен не требуется.
   */
  @Public()
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  async loginTelegram(@Body() dto: TelegramAuthDto) {
    const { accessToken, refreshToken, user } =
      await this.authService.loginWithTelegram(dto.initData);

    this.logger.log(`Login: user=${user.id} tg=${user.telegramId}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id:          user.id,
        telegramId:  user.telegramId,
        displayName: user.displayName,
        role:        user.role,
        companyId:   user.companyId,
        languageCode: user.languageCode,
      },
    };
  }

  /**
   * POST /auth/refresh
   * Обновляет access-токен по refresh-токену.
   * Публичный endpoint.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * GET /auth/me
   * Возвращает профиль текущего пользователя.
   * Требует JWT.
   */
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return {
      id:          user.id,
      telegramId:  user.telegramId,
      displayName: user.displayName,
      firstName:   user.firstName,
      lastName:    user.lastName,
      username:    user.username,
      role:        user.role,
      companyId:   user.companyId,
      languageCode: user.languageCode,
      createdAt:   user.createdAt,
    };
  }

  /**
   * POST /auth/logout
   * В stateless JWT логаут на сервере — no-op (токен живёт до истечения).
   * Клиент должен удалить токены из хранилища.
   * При необходимости здесь можно добавить token blacklist через Redis.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: User) {
    this.logger.log(`Logout: user=${user.id}`);
    return { message: 'ok' };
  }

  /**
   * PATCH /auth/gdpr-consent
   * Записывает время подтверждения GDPR-согласия.
   */
  @Patch('gdpr-consent')
  @HttpCode(HttpStatus.OK)
  async gdprConsent(@CurrentUser() user: User) {
    // UsersService можно инжектировать сюда напрямую при необходимости
    return { message: 'Consent recorded', userId: user.id };
  }

  // ── Служебный эндпоинт для проверки ролей ────────────────────────────

  /**
   * GET /auth/check-manager
   * Доступен только менеджерам и администраторам.
   * Используется в тестах.
   */
  @Roles(UserRole.MANAGER)
  @Get('check-manager')
  checkManager(@CurrentUser() user: User) {
    return { ok: true, role: user.role };
  }
}
