import { Repository } from 'typeorm';
import { User } from './user.entity';
import { TelegramUser } from '../auth/interfaces/telegram-user.interface';
export declare class UsersService {
    private readonly repo;
    constructor(repo: Repository<User>);
    findByTelegramId(telegramId: string): Promise<User | null>;
    findById(id: number): Promise<User | null>;
    upsert(tgUser: TelegramUser): Promise<User>;
}
