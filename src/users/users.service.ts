import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { TelegramUser } from '../auth/interfaces/telegram-user.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  /**
   * Найти пользователя по Telegram ID.
   */
  findByTelegramId(telegramId: string): Promise<User | null> {
    return this.repo.findOne({ where: { telegramId } });
  }

  /**
   * Найти пользователя по внутреннему ID.
   */
  findById(id: number): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Создать или обновить пользователя на основе данных Telegram.
   * Вызывается при каждой авторизации — синхронизирует имя / username.
   */
  async upsert(tgUser: TelegramUser): Promise<User> {
    let user = await this.findByTelegramId(String(tgUser.id));

    if (!user) {
      user = this.repo.create({
        telegramId:   String(tgUser.id),
        username:     tgUser.username,
        firstName:    tgUser.first_name,
        lastName:     tgUser.last_name,
        languageCode: tgUser.language_code ?? 'en',
      });
    } else {
      // Обновляем изменяемые поля
      user.username     = tgUser.username     ?? user.username;
      user.firstName    = tgUser.first_name   ?? user.firstName;
      user.lastName     = tgUser.last_name    ?? user.lastName;
      user.languageCode = tgUser.language_code ?? user.languageCode;
    }

    return this.repo.save(user).catch(() => this.repo.findOneOrFail({ where: { telegramId: String(tgUser.id) } }));
  }

  /**
   * Найти или создать стаб-пользователя по Telegram ID.
   * Используется при регистрации клиента менеджером.
   */
  async findOrCreateByTelegramId(telegramId: string, firstName?: string): Promise<User> {
    let user = await this.findByTelegramId(telegramId);
    if (!user) {
      user = this.repo.create({
        telegramId,
        firstName: firstName ?? 'Client',
        lastName:  '',
        languageCode: 'ru',
      });
      user = await this.repo.save(user);
    }
    return user;
  }

  /**
   * Привязать пользователя к компании.
   */
  async linkToCompany(userId: number, companyId: number): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new Error(`User #${userId} not found`);
    user.companyId = companyId;
    return this.repo.save(user);
  }
}
