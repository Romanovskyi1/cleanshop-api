import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { ParsedInitData, TelegramUser } from './interfaces/telegram-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

// Максимальный допустимый возраст initData (в секундах).
// Telegram рекомендует 1 час; для B2B-TMA можно поднять до 24 часов.
const MAX_AGE_SECONDS = 86_400;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users:  UsersService,
    private readonly jwt:    JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Точка входа: принимает сырой initData, верифицирует, создаёт/обновляет
   * пользователя, возвращает access + refresh токены.
   */
  async loginWithTelegram(
    rawInitData: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const parsed = this.verifyInitData(rawInitData);
    const user   = await this.users.upsert(parsed.user);

    return {
      accessToken:  this.signAccess(user),
      refreshToken: this.signRefresh(user),
      user,
    };
  }

  /**
   * Обновить access-токен по валидному refresh-токену.
   */
  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string }> {
    let payload: JwtPayload;

    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token невалиден или истёк');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return { accessToken: this.signAccess(user) };
  }

  /**
   * Верификация JWT access-токена.
   * Используется JwtStrategy (Passport).
   */
  async validatePayload(payload: JwtPayload): Promise<User> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return user;
  }

  // ── Telegram InitData verification ───────────────────────────────────

  /**
   * Верифицирует initData согласно официальной документации Telegram:
   * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   *
   * Алгоритм:
   *  1. Разобрать строку query-параметров
   *  2. Извлечь и удалить hash
   *  3. Отсортировать оставшиеся пары ключ=значение по ключу
   *  4. Объединить через \n → data_check_string
   *  5. secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
   *  6. Ожидаемый hash = HMAC-SHA256(secret_key, data_check_string)
   *  7. Сравнить hash через timingSafeEqual
   */
  private verifyInitData(rawInitData: string): ParsedInitData {
    const botToken = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');

    // Парсим как URL-search-params
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(rawInitData);
    } catch {
      throw new BadRequestException('initData: некорректный формат');
    }

    const receivedHash = params.get('hash');
    if (!receivedHash) {
      throw new BadRequestException('initData: отсутствует hash');
    }

    // Удаляем hash из params, собираем data_check_string
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Вычисляем secret_key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем ожидаемый hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Безопасное сравнение (защита от timing-attack)
    const expected = Buffer.from(expectedHash, 'hex');
    const received = Buffer.from(receivedHash, 'hex');

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      this.logger.warn('initData: неверная подпись');
      throw new UnauthorizedException('initData: неверная подпись');
    }

    // Проверяем возраст данных
    const authDate = Number(params.get('auth_date'));
    if (!authDate) {
      throw new BadRequestException('initData: отсутствует auth_date');
    }

    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > MAX_AGE_SECONDS) {
      throw new UnauthorizedException(
        `initData устарел (возраст ${ageSeconds}с > ${MAX_AGE_SECONDS}с)`,
      );
    }

    // Парсим объект пользователя
    const userRaw = params.get('user');
    if (!userRaw) {
      throw new BadRequestException('initData: отсутствует user');
    }

    let tgUser: TelegramUser;
    try {
      tgUser = JSON.parse(userRaw);
    } catch {
      throw new BadRequestException('initData: user не является валидным JSON');
    }

    if (!tgUser.id) {
      throw new BadRequestException('initData: user.id отсутствует');
    }

    return {
      user:       tgUser,
      auth_date:  authDate,
      hash:       receivedHash,
      chat_type:  params.get('chat_type') ?? undefined,
      start_param: params.get('start_param') ?? undefined,
    };
  }

  // ── Token helpers ─────────────────────────────────────────────────────

  private signAccess(user: User): string {
    const payload: JwtPayload = {
      sub:  user.id,
      tid:  user.telegramId,
      role: user.role,
    };
    return this.jwt.sign(payload, {
      secret:    this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES', '15m'),
    });
  }

  private signRefresh(user: User): string {
    const payload: JwtPayload = {
      sub:  user.id,
      tid:  user.telegramId,
      role: user.role,
    };
    return this.jwt.sign(payload, {
      secret:    this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES', '30d'),
    });
  }
  async devLogin(telegramId: string): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) throw new Error('User not found');
    return {
      accessToken:  this.signAccess(user),
      refreshToken: this.signRefresh(user),
      user,
    };
  }
}
