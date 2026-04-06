import { AuthService } from './auth.service';
import { TelegramAuthDto, RefreshTokenDto, CredentialsLoginDto } from './dto/auth.dto';
import { UserRole, User } from '../users/user.entity';
export declare class AuthController {
    private readonly authService;
    private readonly logger;
    constructor(authService: AuthService);
    loginTelegram(dto: TelegramAuthDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: number;
            telegramId: string;
            displayName: string;
            role: UserRole;
            companyId: number;
            languageCode: string;
        };
    }>;
    refresh(dto: RefreshTokenDto): Promise<{
        accessToken: string;
    }>;
    me(user: User): {
        id: number;
        telegramId: string;
        displayName: string;
        role: UserRole;
        companyId: number;
        languageCode: string;
    };
    logout(): void;
    gdprConsent(user: User): {
        ok: boolean;
    };
    checkManager(user: User): {
        ok: boolean;
        role: UserRole;
    };
    login(dto: CredentialsLoginDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: number;
            telegramId: string;
            displayName: string;
            role: string;
            companyId: number | null;
            languageCode: string;
        };
    }>;
    devLogin(body: {
        telegramId: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: number;
            telegramId: string;
            displayName: string;
            role: UserRole;
            companyId: number;
            languageCode: string;
        };
    }>;
}
