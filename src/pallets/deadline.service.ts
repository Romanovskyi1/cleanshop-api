import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository }    from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { PalletsService } from '../pallets/pallets.service';

// Заглушка — заменить на реальный OrdersRepository и TelegramService
interface Order {
  id:            number;
  companyId:     number;
  confirmedDate: Date;
  status:        string;
}

/**
 * DeadlineService — управляет окном редактирования паллет.
 *
 * Логика окна:
 *  - Открывается: за 5 дней до confirmedDate
 *  - Дедлайн:     в 23:59 за 1 день до confirmedDate
 *  - Напоминания: за 2 дня и за 1 день
 *
 * Cron запускается каждый день в 09:00 UTC.
 */
@Injectable()
export class DeadlineService {
  private readonly logger = new Logger(DeadlineService.name);

  constructor(
    private readonly palletsService: PalletsService,
    // @InjectRepository(Order) private readonly orders: Repository<Order>,
    // private readonly telegramService: TelegramService,
  ) {}

  /**
   * Ежедневная проверка в 09:00 UTC.
   * Отправляет push-уведомления о статусе окна паллет.
   */
  @Cron('0 9 * * *', { name: 'pallet-deadline-check', timeZone: 'UTC' })
  async checkDeadlines(): Promise<void> {
    this.logger.log('Проверка дедлайнов паллет...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Дата через 5 дней — открываем окно
    const openDate = new Date(today);
    openDate.setDate(openDate.getDate() + 5);

    // Дата через 2 дня — напоминание 1
    const reminder1Date = new Date(today);
    reminder1Date.setDate(reminder1Date.getDate() + 2);

    // Дата через 1 день — финальное напоминание
    const reminder2Date = new Date(today);
    reminder2Date.setDate(reminder2Date.getDate() + 1);

    // Дата сегодня — закрываем окно (дедлайн вчера 23:59)
    const lockDate = new Date(today);

    this.logger.debug({
      openDate,
      reminder1Date,
      reminder2Date,
      lockDate,
    });

    // TODO: заменить на реальные запросы к БД
    // const ordersToOpen      = await this.findOrdersByDate(openDate);
    // const ordersReminder1   = await this.findOrdersByDate(reminder1Date);
    // const ordersReminder2   = await this.findOrdersByDate(reminder2Date);
    // const ordersToLock      = await this.findOrdersByDate(lockDate);

    // await this.sendOpenNotifications(ordersToOpen);
    // await this.sendReminder1Notifications(ordersReminder1);
    // await this.sendReminder2Notifications(ordersReminder2);
    // await this.lockExpiredOrders(ordersToLock);
  }

  /**
   * Заблокировать паллеты и применить авто-распределение.
   * Вызывается для каждого заказа с истёкшим дедлайном.
   */
  async lockOrderPallets(orderId: number, companyId: number): Promise<void> {
    try {
      const result = await this.palletsService.lockAll(orderId, companyId);
      this.logger.log(
        `Заказ #${orderId}: заблокировано ${result.locked} пал., ` +
        `авто-назначено ${result.autoAssigned} пал.`,
      );

      if (result.autoAssigned > 0) {
        // TODO: Push клиенту: "Применено авто-распределение — проверь"
        this.logger.warn(
          `Заказ #${orderId}: авто-распределено ${result.autoAssigned} паллет. ` +
          `Уведомление клиенту отправить через TelegramService.`,
        );
      }
    } catch (err) {
      this.logger.error(`Ошибка блокировки заказа #${orderId}: ${err.message}`);
    }
  }

  // ── Форматирование пушей ────────────────────────────────────────────────────

  static buildOpenMessage(orderNumber: number, deadlineDate: Date): string {
    const dateStr = deadlineDate.toLocaleDateString('ru-RU', {
      day: '2-digit', month: 'long',
    });
    return (
      `📦 <b>Окно сборки паллет открыто</b>\n\n` +
      `Погрузка #${orderNumber}: можно распределять паллеты по фурам.\n` +
      `Дедлайн: <b>${dateStr} в 23:59</b>`
    );
  }

  static buildReminder1Message(orderNumber: number, daysLeft: number): string {
    return (
      `⏳ <b>Напоминание о паллетах</b>\n\n` +
      `Погрузка #${orderNumber}: осталось <b>${daysLeft} дня</b> для сборки паллет.\n` +
      `Не забудь распределить все паллеты по фурам!`
    );
  }

  static buildFinalReminderMessage(orderNumber: number): string {
    return (
      `🔴 <b>Последний день!</b>\n\n` +
      `Погрузка #${orderNumber}: окно закрывается сегодня в 23:59.\n` +
      `После этого паллеты будут распределены автоматически.`
    );
  }

  static buildLockedMessage(orderNumber: number, autoAssigned: number): string {
    const autoNote = autoAssigned > 0
      ? `\n⚠️ Авто-распределено: ${autoAssigned} паллет. Проверь план загрузки.`
      : '';
    return (
      `🔒 <b>Окно паллет закрыто</b>\n\n` +
      `Погрузка #${orderNumber}: распределение зафиксировано.` +
      autoNote
    );
  }
}
