import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }       from '@nestjs/config';
import FormData                from 'form-data';
import fetch                   from 'node-fetch';

export interface TelegramSendResult {
  ok:         boolean;
  messageId?: number;
  error?:     string;
}

/**
 * TelegramDeliveryService
 *
 * Отправляет PDF инвойса в Telegram через Bot API.
 * Поддерживает два варианта:
 *   1. sendDocument с Buffer (прямая загрузка файла)
 *   2. sendDocument с URL (если файл уже в S3)
 */
@Injectable()
export class TelegramDeliveryService {
  private readonly logger  = new Logger(TelegramDeliveryService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const token  = config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  // ── Личный чат клиента ─────────────────────────────────────────────────────

  /**
   * Отправить инвойс в личный Telegram-чат клиента.
   *
   * @param telegramId  — telegram_id клиента (bigint как string)
   * @param pdfBuffer   — PDF-файл
   * @param caption     — подпись под файлом
   * @param filename    — имя файла
   */
  async sendToPersonalChat(
    telegramId: string,
    pdfBuffer:  Buffer,
    caption:    string,
    filename:   string,
  ): Promise<TelegramSendResult> {
    return this.sendDocument(telegramId, pdfBuffer, caption, filename);
  }

  // ── Групповой чат (клиент + менеджер) ─────────────────────────────────────

  /**
   * Отправить инвойс в групповой чат.
   * groupChatId хранится в настройках компании или orders.group_chat_id.
   */
  async sendToGroupChat(
    groupChatId: string,
    pdfBuffer:   Buffer,
    caption:     string,
    filename:    string,
  ): Promise<TelegramSendResult> {
    return this.sendDocument(groupChatId, pdfBuffer, caption, filename);
  }

  // ── Уведомление менеджеру ──────────────────────────────────────────────────

  /**
   * Отправить текстовое уведомление менеджеру (без PDF).
   */
  async notifyManager(chatId: string, text: string): Promise<TelegramSendResult> {
    return this.sendMessage(chatId, text);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async sendDocument(
    chatId:    string,
    buffer:    Buffer,
    caption:   string,
    filename:  string,
  ): Promise<TelegramSendResult> {
    try {
      const form = new FormData();
      form.append('chat_id',    chatId);
      form.append('caption',    caption, { contentType: 'text/plain' });
      form.append('parse_mode', 'HTML');
      form.append('document',   buffer, {
        filename,
        contentType: 'application/pdf',
      });

      const res  = await fetch(`${this.baseUrl}/sendDocument`, {
        method: 'POST',
        body:   form as any,
      });
      const body = await res.json() as any;

      if (!body.ok) {
        this.logger.warn(`TG sendDocument failed to ${chatId}: ${body.description}`);
        return { ok: false, error: body.description };
      }

      this.logger.log(`TG sendDocument OK → chatId=${chatId} msgId=${body.result.message_id}`);
      return { ok: true, messageId: body.result.message_id };

    } catch (err) {
      this.logger.error(`TG sendDocument exception: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  private async sendMessage(chatId: string, text: string): Promise<TelegramSendResult> {
    try {
      const res  = await fetch(`${this.baseUrl}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      const body = await res.json() as any;

      if (!body.ok) {
        return { ok: false, error: body.description };
      }
      return { ok: true, messageId: body.result.message_id };

    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ── Caption builders ───────────────────────────────────────────────────────

  static buildCaption(params: {
    invoiceNumber: string;
    companyName:   string;
    totalEur:      number;
    dueDate:       string;
    orderId:       number;
  }): string {
    const due = new Date(params.dueDate).toLocaleDateString('ru-RU', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    return [
      `📄 <b>Инвойс ${params.invoiceNumber}</b>`,
      `Компания: ${params.companyName}`,
      `Заказ: #${params.orderId}`,
      `Сумма: <b>€ ${Number(params.totalEur).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</b>`,
      `Срок оплаты: ${due}`,
    ].join('\n');
  }
}
