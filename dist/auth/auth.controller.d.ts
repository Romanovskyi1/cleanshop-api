import { AuthService } from './auth.service';
import { TelegramAuthDto, RefreshTokenDto } from './dto/auth.dto';
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
    getMe(user: User): {
        id: number;
        telegramId: string;
        displayName: string;
        firstName: string;
        lastName: string;
        username: string;
        role: UserRole;
        companyId: number;
        languageCode: string;
        createdAt: Date;
    };
    logout(user: User): {
        message: string;
    };
    gdprConsent(user: User): Promise<{
        message: string;
        userId: number;
    }>;
    checkManager(user: User): {
        ok: boolean;
        role: UserRole;
    };
}
