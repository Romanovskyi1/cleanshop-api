"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const crypto = require("crypto");
const users_service_1 = require("../users/users.service");
const MAX_AGE_SECONDS = 86_400;
let AuthService = AuthService_1 = class AuthService {
    constructor(users, jwt, config) {
        this.users = users;
        this.jwt = jwt;
        this.config = config;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async loginWithTelegram(rawInitData) {
        const parsed = this.verifyInitData(rawInitData);
        const user = await this.users.upsert(parsed.user);
        return {
            accessToken: this.signAccess(user),
            refreshToken: this.signRefresh(user),
            user,
        };
    }
    async refresh(refreshToken) {
        let payload;
        try {
            payload = this.jwt.verify(refreshToken, {
                secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Refresh token невалиден или истёк');
        }
        const user = await this.users.findById(payload.sub);
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('Пользователь не найден');
        }
        return { accessToken: this.signAccess(user) };
    }
    async validatePayload(payload) {
        const user = await this.users.findById(payload.sub);
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException();
        }
        return user;
    }
    verifyInitData(rawInitData) {
        const botToken = this.config.getOrThrow('TELEGRAM_BOT_TOKEN');
        let params;
        try {
            params = new URLSearchParams(rawInitData);
        }
        catch {
            throw new common_1.BadRequestException('initData: некорректный формат');
        }
        const receivedHash = params.get('hash');
        if (!receivedHash) {
            throw new common_1.BadRequestException('initData: отсутствует hash');
        }
        params.delete('hash');
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();
        const expectedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        const expected = Buffer.from(expectedHash, 'hex');
        const received = Buffer.from(receivedHash, 'hex');
        if (expected.length !== received.length ||
            !crypto.timingSafeEqual(expected, received)) {
            this.logger.warn('initData: неверная подпись');
            throw new common_1.UnauthorizedException('initData: неверная подпись');
        }
        const authDate = Number(params.get('auth_date'));
        if (!authDate) {
            throw new common_1.BadRequestException('initData: отсутствует auth_date');
        }
        const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
        if (ageSeconds > MAX_AGE_SECONDS) {
            throw new common_1.UnauthorizedException(`initData устарел (возраст ${ageSeconds}с > ${MAX_AGE_SECONDS}с)`);
        }
        const userRaw = params.get('user');
        if (!userRaw) {
            throw new common_1.BadRequestException('initData: отсутствует user');
        }
        let tgUser;
        try {
            tgUser = JSON.parse(userRaw);
        }
        catch {
            throw new common_1.BadRequestException('initData: user не является валидным JSON');
        }
        if (!tgUser.id) {
            throw new common_1.BadRequestException('initData: user.id отсутствует');
        }
        return {
            user: tgUser,
            auth_date: authDate,
            hash: receivedHash,
            chat_type: params.get('chat_type') ?? undefined,
            start_param: params.get('start_param') ?? undefined,
        };
    }
    signAccess(user) {
        const payload = {
            sub: user.id,
            tid: user.telegramId,
            role: user.role,
        };
        return this.jwt.sign(payload, {
            secret: this.config.getOrThrow('JWT_SECRET'),
            expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m'),
        });
    }
    signRefresh(user) {
        const payload = {
            sub: user.id,
            tid: user.telegramId,
            role: user.role,
        };
        return this.jwt.sign(payload, {
            secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
            expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '30d'),
        });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map