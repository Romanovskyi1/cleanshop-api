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
import { TelegramAuthDto, RefreshTokenDto, CredentialsLoginDto } from './dto/auth.dto';
import { Public }       from '../common/decorators/public.decorator';
import { CurrentUser }  from '../common/decorators/current-user.decorator';
import { Roles }        from '../common/decorators/roles.decorator';
import { UserRole, User } from '../users/user.entity';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

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

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return {
      id:          user.id,
      telegramId:  user.telegramId,
      displayName: user.displayName,
      role:        user.role,
      companyId:   user.companyId,
      languageCode: user.languageCode,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout() {
    return;
  }

  @Patch('gdpr-consent')
  @HttpCode(HttpStatus.OK)
  gdprConsent(@CurrentUser() user: User) {
    return { ok: true };
  }

  @Roles(UserRole.MANAGER)
  @Get('check-manager')
  checkManager(@CurrentUser() user: User) {
    return { ok: true, role: user.role };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: CredentialsLoginDto) {
    const result = await this.authService.loginWithCredentials(dto.username, dto.password);
    return result;
  }

  @Public()
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin(@Body() body: { telegramId: string }) {
    const result = await this.authService.devLogin(body.telegramId);
    return {
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        id:          result.user.id,
        telegramId:  result.user.telegramId,
        displayName: result.user.displayName,
        role:        result.user.role,
        companyId:   result.user.companyId,
        languageCode: result.user.languageCode,
      },
    };
  }
}
