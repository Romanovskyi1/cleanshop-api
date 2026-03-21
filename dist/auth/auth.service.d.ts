import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';
export declare class AuthService {
    private readonly users;
    private readonly jwt;
    private readonly config;
    private readonly logger;
    constructor(users: UsersService, jwt: JwtService, config: ConfigService);
    loginWithTelegram(rawInitData: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: User;
    }>;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
    }>;
    validatePayload(payload: JwtPayload): Promise<User>;
    private verifyInitData;
    private signAccess;
    private signRefresh;
}
