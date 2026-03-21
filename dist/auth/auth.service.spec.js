"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const auth_service_1 = require("./auth.service");
const users_service_1 = require("../users/users.service");
const user_entity_1 = require("../users/user.entity");
function buildInitData(botToken, user = { id: 123456, first_name: 'Klaus', username: 'klausw' }, overrideAuthDate) {
    const authDate = overrideAuthDate ?? Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({
        user: JSON.stringify(user),
        auth_date: String(authDate),
        chat_type: 'private',
    });
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
const BOT_TOKEN = 'test_bot_token_1234567890';
const JWT_SECRET = 'test_jwt_secret_access';
const JWT_REFRESH = 'test_jwt_secret_refresh';
const mockUser = {
    id: 1,
    telegramId: '123456',
    firstName: 'Klaus',
    lastName: 'Weber',
    username: 'klausw',
    languageCode: 'de',
    role: user_entity_1.UserRole.CLIENT,
    companyId: null,
    isActive: true,
    gdprConsentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    get isManager() { return false; },
    get isAdmin() { return false; },
    get displayName() { return 'Klaus Weber'; },
};
describe('AuthService', () => {
    let service;
    let usersService;
    let jwtService;
    let configService;
    beforeEach(async () => {
        const usersServiceMock = {
            upsert: jest.fn().mockResolvedValue(mockUser),
            findById: jest.fn().mockResolvedValue(mockUser),
        };
        const jwtServiceMock = {
            sign: jest.fn().mockReturnValue('mock.jwt.token'),
            verify: jest.fn().mockReturnValue({ sub: 1, tid: '123456', role: user_entity_1.UserRole.CLIENT }),
        };
        const configServiceMock = {
            getOrThrow: jest.fn((key) => {
                const map = {
                    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
                    JWT_SECRET: JWT_SECRET,
                    JWT_REFRESH_SECRET: JWT_REFRESH,
                };
                if (!map[key])
                    throw new Error(`Config key not found: ${key}`);
                return map[key];
            }),
            get: jest.fn((key, fallback) => {
                const map = {
                    JWT_ACCESS_EXPIRES: '15m',
                    JWT_REFRESH_EXPIRES: '30d',
                };
                return map[key] ?? fallback;
            }),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                auth_service_1.AuthService,
                { provide: users_service_1.UsersService, useValue: usersServiceMock },
                { provide: jwt_1.JwtService, useValue: jwtServiceMock },
                { provide: config_1.ConfigService, useValue: configServiceMock },
            ],
        }).compile();
        service = module.get(auth_service_1.AuthService);
        usersService = module.get(users_service_1.UsersService);
        jwtService = module.get(jwt_1.JwtService);
        configService = module.get(config_1.ConfigService);
    });
    describe('loginWithTelegram', () => {
        it('должен вернуть токены при валидном initData', async () => {
            const initData = buildInitData(BOT_TOKEN);
            const result = await service.loginWithTelegram(initData);
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.user).toEqual(mockUser);
            expect(usersService.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 123456, first_name: 'Klaus' }));
        });
        it('должен выбросить UnauthorizedException при неверном hash', async () => {
            const initData = buildInitData(BOT_TOKEN)
                .replace(/hash=[^&]+/, 'hash=000000000000000000000000000000000000000000000000000000000000dead');
            await expect(service.loginWithTelegram(initData))
                .rejects.toThrow(common_1.UnauthorizedException);
        });
        it('должен выбросить UnauthorizedException при устаревшем initData', async () => {
            const staleDate = Math.floor(Date.now() / 1000) - 172_800;
            const initData = buildInitData(BOT_TOKEN, undefined, staleDate);
            await expect(service.loginWithTelegram(initData))
                .rejects.toThrow(common_1.UnauthorizedException);
        });
        it('должен выбросить BadRequestException при отсутствии hash', async () => {
            const initData = 'user=%7B%22id%22%3A1%7D&auth_date=1700000000';
            await expect(service.loginWithTelegram(initData))
                .rejects.toThrow(common_1.BadRequestException);
        });
        it('должен выбросить BadRequestException при некорректном JSON пользователя', async () => {
            const params = new URLSearchParams({ user: 'not_json', auth_date: '1700000000', hash: 'aaa' });
            await expect(service.loginWithTelegram(params.toString()))
                .rejects.toThrow();
        });
    });
    describe('refresh', () => {
        it('должен вернуть новый accessToken по валидному refreshToken', async () => {
            const result = await service.refresh('valid.refresh.token');
            expect(result.accessToken).toBe('mock.jwt.token');
            expect(jwtService.verify).toHaveBeenCalled();
        });
        it('должен выбросить UnauthorizedException при невалидном refreshToken', async () => {
            jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
            await expect(service.refresh('bad.token'))
                .rejects.toThrow(common_1.UnauthorizedException);
        });
        it('должен выбросить UnauthorizedException если пользователь не найден', async () => {
            usersService.findById.mockResolvedValueOnce(null);
            await expect(service.refresh('valid.refresh.token'))
                .rejects.toThrow(common_1.UnauthorizedException);
        });
    });
    describe('validatePayload', () => {
        it('должен вернуть пользователя при валидном payload', async () => {
            const user = await service.validatePayload({
                sub: 1, tid: '123456', role: user_entity_1.UserRole.CLIENT,
            });
            expect(user).toEqual(mockUser);
        });
        it('должен выбросить UnauthorizedException если пользователь неактивен', async () => {
            usersService.findById.mockResolvedValueOnce({ ...mockUser, isActive: false });
            await expect(service.validatePayload({ sub: 1, tid: '123456', role: user_entity_1.UserRole.CLIENT })).rejects.toThrow(common_1.UnauthorizedException);
        });
    });
});
//# sourceMappingURL=auth.service.spec.js.map