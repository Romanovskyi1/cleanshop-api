// src/orders/orders-cron.service.ts
//
// Ежедневные Cron-задачи:
//   09:00 UTC — открыть окна паллет у заказов за WINDOW_DAYS_BEFORE дней
//   09:05 UTC — напоминания за 2 дня до дедлайна
//   09:10 UTC — напоминания за 1 день до дедлайна
//   00:01 UTC — авто-блокировка просроченных окон

import { Injectable, Logger } from '@nestjs/common';
import { Cron }                from '@nestjs/schedule';
import { OrdersService }       from './orders.service';
import { ConfigService }       from '@nestjs/config';

@Injectable()
export class OrdersCronService {
  private readonly logger = new Logger(OrdersCronService.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  // ── Открыть окна паллет ────────────────────────────────────────────────────

  /**
   * Каждый день в 09:00 UTC.
   * Находит заказы с confirmedDate ровно через WINDOW_DAYS_BEFORE дней
   * и переводит их из confirmed → building.
   * Отправляет Push клиентам через Telegram Bot API.
   */
  @Cron('0 9 * * *', { name: 'open-pallet-windows', timeZone: 'UTC' })
  async openPalletWindows(): Promise<void> {
    this.logger.log('[Cron] Checking orders to open pallet windows...');

    const ordersToOpen = await this.orders.findOrdersToOpenWindow(new Date());

    if (!ordersToOpen.length) {
      this.logger.log('[Cron] No orders to open today');
      return;
    }

    for (const order of ordersToOpen) {
      try {
        await this.orders.openPalletWindow(order.id);

        // Push клиенту
        await this.sendPush(
          order.companyId,
          this.buildOpenMsg(order.id, order.windowClosesAt!),
        );

        this.logger.log(`[Cron] Pallet window opened: order #${order.id}`);
      } catch (err) {
        this.logger.error(`[Cron] Failed to open window for order #${order.id}: ${err.message}`);
      }
    }
  }

  // ── Напоминания ────────────────────────────────────────────────────────────

  /**
   * 09:05 UTC — напоминание за 2 дня до дедлайна.
   */
  @Cron('5 9 * * *', { name: 'reminder-2days', timeZone: 'UTC' })
  async remindTwoDays(): Promise<void> {
    const orders = await this.orders.findOrdersForReminder(2);
    this.logger.log(`[Cron] 2-day reminder: ${orders.length} orders`);

    for (const o of orders) {
      await this.sendPush(
        o.companyId,
        `⏳ <b>Напоминание о паллетах</b>\n\n` +
        `Погрузка #${o.id}: осталось <b>2 дня</b> для сборки паллет.\n` +
        `Дедлайн: ${this.fmtDate(o.windowClosesAt!)}`,
      ).catch(e => this.logger.error(`Push failed: ${e.message}`));
    }
  }

  /**
   * 09:10 UTC — финальное напоминание за 1 день.
   */
  @Cron('10 9 * * *', { name: 'reminder-1day', timeZone: 'UTC' })
  async remindOneDay(): Promise<void> {
    const orders = await this.orders.findOrdersForReminder(1);
    this.logger.log(`[Cron] 1-day reminder: ${orders.length} orders`);

    for (const o of orders) {
      await this.sendPush(
        o.companyId,
        `🔴 <b>Последний день!</b>\n\n` +
        `Погрузка #${o.id}: окно закрывается сегодня в 23:59.\n` +
        `После этого паллеты будут распределены автоматически.`,
      ).catch(e => this.logger.error(`Push failed: ${e.message}`));
    }
  }

  // ── Авто-блокировка ────────────────────────────────────────────────────────

  /**
   * 00:01 UTC — заблокировать просроченные окна.
   * Ищет все building-заказы у которых windowClosesAt < now.
   */
  @Cron('1 0 * * *', { name: 'auto-lock-expired', timeZone: 'UTC' })
  async autoLockExpired(): Promise<void> {
    this.logger.log('[Cron] Checking expired pallet windows...');

    const expired = await this.orders.findExpiredWindows();

    if (!expired.length) {
      this.logger.log('[Cron] No expired windows');
      return;
    }

    for (const order of expired) {
      try {
        await this.orders.autoLock(order.id);

        await this.sendPush(
          order.companyId,
          `🔒 <b>Окно паллет закрыто</b>\n\n` +
          `Погрузка #${order.id}: распределение зафиксировано автоматически.\n` +
          `Проверьте план загрузки.`,
        ).catch(() => {/* не бросаем */});

        this.logger.log(`[Cron] Auto-locked order #${order.id}`);
      } catch (err) {
        this.logger.error(`[Cron] Auto-lock failed for #${order.id}: ${err.message}`);
      }
    }
  }

  // ── Push helper ────────────────────────────────────────────────────────────

  /**
   * Отправить push клиенту через Telegram Bot API.
   *
   * В реальном коде telegramId берётся из CompanyService / UsersService.
   * Здесь — заглушка которую нужно заменить на реальный вызов.
   *
   * TODO: внедрить NotificationsService и вызвать:
   *   await this.notifications.pushToCompany(companyId, text);
   */
  private async sendPush(companyId: number, text: string): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return;

    // TODO: заменить на реальный telegramId клиента из UsersService
    // const user = await this.usersService.findPrimaryContact(companyId);
    // const chatId = user.telegramId;

    this.logger.debug(`[Push] company=${companyId}: ${text.slice(0, 80)}...`);

    // Пример реального вызова (раскомментировать после подключения UsersService):
    // await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    //   method:  'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    // });
  }

  private buildOpenMsg(orderId: number, closes: Date): string {
    return (
      `📦 <b>Окно сборки паллет открыто</b>\n\n` +
      `Погрузка #${orderId}: можно распределять паллеты по фурам.\n` +
      `Дедлайн: <b>${this.fmtDate(closes)}</b>`
    );
  }

  private fmtDate(d: Date): string {
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
    });
  }
}
