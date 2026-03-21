import { Test, TestingModule } from '@nestjs/testing';
import { JwtService }          from '@nestjs/jwt';
import { ConfigService }       from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

import { AuthService }   from './auth.service';
import { UsersService }  from '../users/users.service';
import { User, UserRole } from '../users/user.entity';

// ── Хелпер: генерирует валидный initData для тестов ──────────────────────────
function buildInitData(
  botToken: string,
  user = { id: 123456, first_name: 'Klaus', username: 'klausw' },
  overrideAuthDate?: number,
): string {
  const authDate = overrideAuthDate ?? Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    user:      JSON.stringify(user),
    auth_date: String(authDate),
    chat_type: 'private',
  });

  // Сортируем и собираем data_check_string
  const sorted = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(sorted)
    .digest('hex');

  params.set('hash', hash);
  return params.toString();
}

// ── Моки ─────────────────────────────────────────────────────────────────────
const BOT_TOKEN   = 'test_bot_token_1234567890';
const JWT_SECRET  = 'test_jwt_secret_access';
const JWT_REFRESH = 'test_jwt_secret_refresh';

const mockUser: User = {
  id:          1,
  telegramId:  '123456',
  firstName:   'Klaus',
  lastName:    'Weber',
  username:    'klausw',
  languageCode: 'de',
  role:        UserRole.CLIENT,
  companyId:   null,
  isActive:    true,
  gdprConsentAt: null,
  createdAt:   new Date(),
  updatedAt:   new Date(),
  get isManager() { return false; },
  get isAdmin()   { return false; },
  get displayName() { return 'Klaus Weber'; },
} as unknown as User;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const usersServiceMock: Partial<jest.Mocked<UsersService>> = {
      upsert:     jest.fn().mockResolvedValue(mockUser),
      findById:   jest.fn().mockResolvedValue(mockUser),
    };

    const jwtServiceMock: Partial<jest.Mocked<JwtService>> = {
      sign:   jest.fn().mockReturnValue('mock.jwt.token'),
      verify: jest.fn().mockReturnValue({ sub: 1, tid: '123456', role: UserRole.CLIENT }),
    };

    const configServiceMock: Partial<jest.Mocked<ConfigService>> = {
      getOrThrow: jest.fn((key: string) => {
        const map: Record<string, string> = {
          TELEGRAM_BOT_TOKEN:  BOT_TOKEN,
          JWT_SECRET:          JWT_SECRET,
          JWT_REFRESH_SECRET:  JWT_REFRESH,
        };
        if (!map[key]) throw new Error(`Config key not found: ${key}`);
        return map[key];
      }),
      get: jest.fn((key: string, fallback?: string) => {
        const map: Record<string, string> = {
          JWT_ACCESS_EXPIRES:  '15m',
          JWT_REFRESH_EXPIRES: '30d',
        };
        return map[key] ?? fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService,   useValue: usersServiceMock },
        { provide: JwtService,     useValue: jwtServiceMock },
        { provide: ConfigService,  useValue: configServiceMock },
      ],
    }).compile();

    service       = module.get<AuthService>(AuthService);
    usersService  = module.get(UsersService);
    jwtService    = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  // ── loginWithTelegram ───────────────────────────────────────────────────

  describe('loginWithTelegram', () => {
    it('должен вернуть токены при валидном initData', async () => {
      const initData = buildInitData(BOT_TOKEN);
      const result   = await service.loginWithTelegram(initData);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual(mockUser);
      expect(usersService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 123456, first_name: 'Klaus' }),
      );
    });

    it('должен выбросить UnauthorizedException при неверном hash', async () => {
      const initData = buildInitData(BOT_TOKEN)
        .replace(/hash=[^&]+/, 'hash=000000000000000000000000000000000000000000000000000000000000dead');

      await expect(service.loginWithTelegram(initData))
        .rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить UnauthorizedException при устаревшем initData', async () => {
      // auth_date 2 дня назад (> 86400 сек)
      const staleDate = Math.floor(Date.now() / 1000) - 172_800;
      const initData  = buildInitData(BOT_TOKEN, undefined, staleDate);

      await expect(service.loginWithTelegram(initData))
        .rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить BadRequestException при отсутствии hash', async () => {
      const initData = 'user=%7B%22id%22%3A1%7D&auth_date=1700000000';

      await expect(service.loginWithTelegram(initData))
        .rejects.toThrow(BadRequestException);
    });

    it('должен выбросить BadRequestException при некорректном JSON пользователя', async () => {
      const params = new URLSearchParams({ user: 'not_json', auth_date: '1700000000', hash: 'aaa' });
      await expect(service.loginWithTelegram(params.toString()))
        .rejects.toThrow(); // UnauthorizedException или BadRequestException
    });
  });

  // ── refresh ─────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('должен вернуть новый accessToken по валидному refreshToken', async () => {
      const result = await service.refresh('valid.refresh.token');
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(jwtService.verify).toHaveBeenCalled();
    });

    it('должен выбросить UnauthorizedException при невалидном refreshToken', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.refresh('bad.token'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить UnauthorizedException если пользователь не найден', async () => {
      usersService.findById.mockResolvedValueOnce(null);
      await expect(service.refresh('valid.refresh.token'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // ── validatePayload ──────────────────────────────────────────────────────

  describe('validatePayload', () => {
    it('должен вернуть пользователя при валидном payload', async () => {
      const user = await service.validatePayload({
        sub: 1, tid: '123456', role: UserRole.CLIENT,
      });
      expect(user).toEqual(mockUser);
    });

    it('должен выбросить UnauthorizedException если пользователь неактивен', async () => {
      usersService.findById.mockResolvedValueOnce({ ...mockUser, isActive: false } as User);
      await expect(
        service.validatePayload({ sub: 1, tid: '123456', role: UserRole.CLIENT }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
