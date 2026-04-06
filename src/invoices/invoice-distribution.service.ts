import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }          from 'typeorm';
import { ConfigService }       from '@nestjs/config';

import {
  Invoice, InvoiceDelivery,
  DeliveryChannel, DeliveryStatus,
} from './entities/invoice.entity';
import { S3StorageService }        from './channels/s3-storage.service';
import { TelegramDeliveryService } from './channels/telegram-delivery.service';
import { EmailDeliveryService }    from './channels/email-delivery.service';
import { DistributionResult }      from './dto/invoice.dto';

/**
 * Контакты клиента для рассылки.
 * В реальном проде берётся из Company + User entities.
 */
export interface ClientDeliveryContacts {
  companyName:     string;
  contactName:     string;
  telegramId:      string;        // личный chat_id клиента
  groupChatId:     string | null; // групповой чат клиент+менеджер (может быть null)
  email:           string | null; // email для инвойсов
}

@Injectable()
export class InvoiceDistributionService {
  private readonly logger = new Logger(InvoiceDistributionService.name);

  constructor(
    @InjectRepository(InvoiceDelivery)
    private readonly deliveries: Repository<InvoiceDelivery>,

    private readonly s3:       S3StorageService,
    private readonly telegram: TelegramDeliveryService,
    private readonly email:    EmailDeliveryService,
    private readonly config:   ConfigService,
  ) {}

  /**
   * Главный метод — принимает PDF-буфер, загружает в S3,
   * затем параллельно рассылает по всем запрошенным каналам.
   *
   * @param invoice   — сохранённая запись Invoice из БД
   * @param pdfBuffer — PDF-файл (Buffer)
   * @param contacts  — контактные данные клиента
   * @param channels  — каналы для рассылки (по умолчанию все три)
   */
  async distribute(
    invoice:   Invoice,
    pdfBuffer: Buffer,
    contacts:  ClientDeliveryContacts,
    channels:  DeliveryChannel[] = [
      DeliveryChannel.TELEGRAM_PERSONAL,
      DeliveryChannel.TELEGRAM_GROUP,
      DeliveryChannel.EMAIL,
    ],
  ): Promise<DistributionResult> {

    // 1. Загружаем PDF в S3/R2
    this.logger.log(`[invoice:${invoice.id}] Uploading PDF to S3...`);
    const pdfUrl = await this.s3.uploadPdf(pdfBuffer, invoice.invoiceNumber);

    // 2. Строим caption для Telegram
    const tgCaption = TelegramDeliveryService.buildCaption({
      invoiceNumber: invoice.invoiceNumber,
      companyName:   contacts.companyName,
      totalEur:      invoice.totalEur,
      dueDate:       invoice.dueDate,
      orderId:       invoice.orderId,
    });

    const filename = `${invoice.invoiceNumber}.pdf`;

    // 3. Запускаем рассылку по каналам ПАРАЛЛЕЛЬНО
    this.logger.log(
      `[invoice:${invoice.id}] Distributing to channels: ${channels.join(', ')}`,
    );

    const tasks = channels.map(channel =>
      this.deliverToChannel(invoice, pdfBuffer, filename, tgCaption, contacts, channel, pdfUrl)
    );

    const results = await Promise.allSettled(tasks);

    // 4. Собираем итог
    const channelResults = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        channel: channels[i],
        status:  'failed' as const,
        error:   r.reason?.message ?? 'Unknown error',
      };
    });

    const allSent = channelResults.every(r => r.status === 'sent');

    if (!allSent) {
      const failed = channelResults.filter(r => r.status === 'failed');
      this.logger.warn(
        `[invoice:${invoice.id}] ${failed.length} channel(s) failed: ` +
        failed.map(f => `${f.channel}: ${f.error}`).join('; '),
      );
    }

    // 5. Уведомляем менеджера о результате
    await this.notifyManagerAboutResult(invoice, contacts, channelResults, pdfUrl);

    return {
      invoiceId:  invoice.id,
      pdfUrl,
      channels:   channelResults,
      allSent,
    };
  }

  /**
   * Повторная рассылка по неудачным или указанным каналам.
   */
  async resend(
    invoice:   Invoice,
    pdfBuffer: Buffer,
    contacts:  ClientDeliveryContacts,
    channels?: DeliveryChannel[],
  ): Promise<DistributionResult> {
    // Если каналы не указаны — повторяем только упавшие
    let targetChannels = channels;
    if (!targetChannels) {
      const failed = await this.deliveries.find({
        where: { invoiceId: invoice.id, status: DeliveryStatus.FAILED },
      });
      targetChannels = failed.map(d => d.channel);
    }

    if (!targetChannels.length) {
      this.logger.log(`[invoice:${invoice.id}] Resend: нет каналов для повтора`);
      return { invoiceId: invoice.id, pdfUrl: invoice.pdfUrl ?? '', channels: [], allSent: true };
    }

    this.logger.log(`[invoice:${invoice.id}] Resend channels: ${targetChannels.join(', ')}`);
    return this.distribute(invoice, pdfBuffer, contacts, targetChannels);
  }

  /**
   * Получить статус рассылки по инвойсу.
   */
  async getDeliveryStatus(invoiceId: number): Promise<InvoiceDelivery[]> {
    return this.deliveries.find({
      where:  { invoiceId },
      order:  { createdAt: 'ASC' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ══════════════════════════════════════════════════════════════════════

  private async deliverToChannel(
    invoice:   Invoice,
    pdfBuffer: Buffer,
    filename:  string,
    tgCaption: string,
    contacts:  ClientDeliveryContacts,
    channel:   DeliveryChannel,
    pdfUrl:    string,
  ): Promise<{ channel: DeliveryChannel; status: 'sent' | 'failed'; error?: string }> {

    // Создаём запись о попытке в БД
    const delivery = await this.deliveries.save(
      this.deliveries.create({
        invoiceId: invoice.id,
        channel,
        status:    DeliveryStatus.SENT,
      }),
    );

    try {
      let result: { ok: boolean; messageId?: number | string; error?: string };

      switch (channel) {

        // ── Личный чат Telegram ───────────────────────────────────────────
        case DeliveryChannel.TELEGRAM_PERSONAL:
          if (!contacts.telegramId) {
            throw new Error('telegramId клиента не задан');
          }
          result = await this.telegram.sendToPersonalChat(
            contacts.telegramId,
            pdfBuffer,
            tgCaption,
            filename,
          );
          break;

        // ── Групповой чат Telegram ────────────────────────────────────────
        case DeliveryChannel.TELEGRAM_GROUP:
          if (!contacts.groupChatId) {
            // Групповой чат не создан — пропускаем без ошибки
            this.logger.warn(`[invoice:${invoice.id}] groupChatId не задан — пропуск`);
            await this.deliveries.update(delivery.id, {
              status:       DeliveryStatus.FAILED,
              errorMessage: 'groupChatId не настроен для этой компании',
              sentAt:       new Date(),
            });
            return { channel, status: 'failed', error: 'groupChatId не настроен' };
          }
          result = await this.telegram.sendToGroupChat(
            contacts.groupChatId,
            pdfBuffer,
            tgCaption,
            filename,
          );
          break;

        // ── Email ─────────────────────────────────────────────────────────
        case DeliveryChannel.EMAIL:
          if (!contacts.email) {
            throw new Error('Email клиента не задан');
          }
          result = await this.email.sendInvoice(
            contacts.email,
            pdfBuffer,
            invoice.invoiceNumber,
            {
              companyName:  contacts.companyName,
              contactName:  contacts.contactName,
              orderId:      invoice.orderId,
              totalEur:     Number(invoice.totalEur),
              dueDate:      invoice.dueDate,
              subtotalEur:  Number(invoice.subtotalEur),
              vatRate:      Number(invoice.vatRate),
              vatAmount:    Number(invoice.vatAmount),
            },
          );
          break;

        default:
          throw new Error(`Неизвестный канал: ${channel}`);
      }

      if (!result.ok) throw new Error(result.error ?? 'Delivery failed');

      // Успех — обновляем запись
      await this.deliveries.update(delivery.id, {
        status:     DeliveryStatus.SENT,
        // externalId removed
        sentAt:     new Date(),
      });

      this.logger.log(`[invoice:${invoice.id}] Channel ${channel} → SENT`);
      return { channel, status: 'sent' };

    } catch (err: any) {
      // Провал — логируем ошибку
      await this.deliveries.update(delivery.id, {
        status:       DeliveryStatus.FAILED,
        errorMessage: err.message,
        sentAt:       new Date(),
      });

      this.logger.error(`[invoice:${invoice.id}] Channel ${channel} → FAILED: ${err.message}`);
      return { channel, status: 'failed', error: err.message };
    }
  }

  /**
   * Уведомить менеджера о результатах рассылки.
   */
  private async notifyManagerAboutResult(
    invoice:  Invoice,
    contacts: ClientDeliveryContacts,
    results:  Array<{ channel: DeliveryChannel | string; status: string; error?: string }>,
    pdfUrl:   string,
  ): Promise<void> {
    const managerChatId = this.config.get<string>('TELEGRAM_MANAGER_CHAT_ID');
    if (!managerChatId) return;

    const allSent   = results.every(r => r.status === 'sent');
    const failed    = results.filter(r => r.status === 'failed');
    const icon      = allSent ? '✅' : '⚠️';

    const channelLabels: Record<string, string> = {
      telegram_personal: 'Личный TG',
      telegram_group:    'Групповой TG',
      email:             'Email',
    };

    const statusLines = results.map(r =>
      `${r.status === 'sent' ? '✓' : '✗'} ${channelLabels[r.channel] ?? r.channel}` +
      (r.error ? ` (${r.error})` : '')
    );

    const text = [
      `${icon} <b>Инвойс ${invoice.invoiceNumber} разослан</b>`,
      `Компания: ${contacts.companyName}`,
      `Заказ: #${invoice.orderId}`,
      `Сумма: € ${Number(invoice.totalEur).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,
      '',
      'Каналы:',
      ...statusLines,
      ...(failed.length ? [`\nПровалившиеся каналы: ${failed.length}`] : []),
    ].join('\n');

    try {
      const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
      if (!token) return;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          chat_id:    managerChatId,
          text,
          parse_mode: 'HTML',
        }),
      });
    } catch (err) {
      this.logger.warn(`Не удалось уведомить менеджера: ${err.message}`);
    }
  }
}
