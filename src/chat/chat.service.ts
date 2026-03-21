import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService }      from '@nestjs/config';

import { ChatMessage, SenderType, MessageIntent } from './entities/chat-message.entity';
import { AiService }   from './ai.service';
import { ParsedAiResponse, WsMessageEvent } from './dto/chat.dto';
import { buildEscalationContext, ClientContext } from './prompts/system-prompt';

// Telegram Bot API push helper (упрощённый — заменить на TelegramService)
async function sendTelegramPush(botToken: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatMessage)
    private readonly messages: Repository<ChatMessage>,

    private readonly ai:     AiService,
    private readonly config: ConfigService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // ИСТОРИЯ СООБЩЕНИЙ
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Получить историю чата компании (пагинация назад по курсору).
   */
  async getHistory(
    companyId: number,
    limit   = 50,
    before?: string,
  ): Promise<ChatMessage[]> {
    const where: any = { companyId };
    if (before) where.id = LessThan(before);

    return this.messages.find({
      where,
      order:  { createdAt: 'DESC' },
      take:   limit,
    }).then(msgs => msgs.reverse()); // возвращаем в хронологическом порядке
  }

  // ══════════════════════════════════════════════════════════════════════
  // ОБРАБОТКА ВХОДЯЩЕГО СООБЩЕНИЯ
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Главный метод: принять сообщение клиента, сохранить, получить ответ.
   * Возвращает ответное сообщение (от ИИ или менеджера).
   */
  async handleClientMessage(
    companyId:     number,
    senderId:      number,
    text:          string,
    ctx:           ClientContext,
    attachmentUrl: string | null = null,
  ): Promise<{
    clientMsg: ChatMessage;
    replyMsg:  ChatMessage | null;
    aiResponse: ParsedAiResponse | null;
    shouldEscalate: boolean;
  }> {
    // 1. Сохраняем сообщение клиента
    const clientMsg = await this.saveMessage({
      companyId,
      senderId,
      senderType: SenderType.CLIENT,
      text,
      attachmentUrl,
    });

    // 2. Определяем режим
    const isAiMode = this.ai.isAiMode();

    if (!isAiMode) {
      // Рабочее время — только сохраняем, менеджер ответит вручную
      this.logger.log(`[chat:${companyId}] Рабочее время — ждём ответа менеджера`);
      return { clientMsg, replyMsg: null, aiResponse: null, shouldEscalate: false };
    }

    // 3. ИИ-режим: готовим историю и вызываем Claude
    const history = await this.buildAiHistory(companyId);
    const aiResponse = await this.ai.chat(text, history, ctx);

    // 4. Сохраняем ответ ИИ
    const replyMsg = await this.saveMessage({
      companyId,
      senderId:    null,
      senderType:  SenderType.AI,
      text:        aiResponse.text,
      intent:      aiResponse.intent,
      cardPayload: aiResponse.cardPayload,
    });

    // 5. Эскалация
    const shouldEscalate = aiResponse.intent === MessageIntent.ESCALATE
      || !!aiResponse.escalation;

    if (shouldEscalate) {
      await this.escalateToManager(companyId, ctx, text, aiResponse);
    }

    return { clientMsg, replyMsg, aiResponse, shouldEscalate };
  }

  /**
   * Сохранить ответ менеджера (вызывается из Gateway при ручном ответе).
   */
  async saveManagerReply(
    companyId:  number,
    managerId:  number,
    text:       string,
    attachmentUrl: string | null = null,
  ): Promise<ChatMessage> {
    return this.saveMessage({
      companyId,
      senderId:   managerId,
      senderType: SenderType.MANAGER,
      text,
      attachmentUrl,
    });
  }

  /**
   * Пометить сообщения как прочитанные.
   */
  async markRead(companyId: number, messageId: string): Promise<void> {
    await this.messages.update(
      { id: messageId, companyId },
      { isRead: true },
    );
  }

  /**
   * Получить статус чата для клиентского UI.
   */
  getChatStatus() {
    return this.ai.getChatStatus();
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ══════════════════════════════════════════════════════════════════════

  private async saveMessage(data: {
    companyId:    number;
    senderId:     number | null;
    senderType:   SenderType;
    text:         string;
    attachmentUrl?: string | null;
    intent?:       MessageIntent | null;
    cardPayload?:  Record<string, unknown> | null;
  }): Promise<ChatMessage> {
    const msg = this.messages.create({
      companyId:    data.companyId,
      senderId:     data.senderId ?? null,
      senderType:   data.senderType,
      text:         data.text,
      attachmentUrl: data.attachmentUrl ?? null,
      intent:       data.intent       ?? null,
      cardPayload:  data.cardPayload  ?? null,
    });
    return this.messages.save(msg);
  }

  /**
   * Построить историю для Claude из последних сообщений БД.
   * Чередует роли user/assistant — Claude требует это строго.
   */
  private async buildAiHistory(
    companyId: number,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const msgs = await this.messages.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take:  40, // берём с запасом
    });

    // Разворачиваем в хронологический порядок
    msgs.reverse();

    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of msgs) {
      if (msg.senderType === SenderType.CLIENT) {
        history.push({ role: 'user', content: msg.text });
      } else if (
        msg.senderType === SenderType.AI ||
        msg.senderType === SenderType.MANAGER
      ) {
        history.push({ role: 'assistant', content: msg.text });
      }
    }

    // Claude требует чередование user/assistant — убираем дубли подряд
    const deduped: typeof history = [];
    for (const item of history) {
      const last = deduped[deduped.length - 1];
      if (last?.role === item.role) {
        // Объединяем два подряд идущих сообщения одной роли
        last.content += `\n\n${item.content}`;
      } else {
        deduped.push({ ...item });
      }
    }

    // Должно начинаться с user
    if (deduped.length && deduped[0].role !== 'user') {
      deduped.shift();
    }

    return deduped.slice(-20); // последние 20 после дедупликации
  }

  /**
   * Отправить Push-уведомление менеджеру при эскалации.
   */
  private async escalateToManager(
    companyId:   number,
    ctx:         ClientContext,
    userMessage: string,
    aiResponse:  ParsedAiResponse,
  ): Promise<void> {
    const urgency = aiResponse.escalation?.urgency ?? 'normal';
    const reason  = aiResponse.escalation?.reason  ?? 'Requires attention';

    const botToken  = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const managerId = this.config.get<string>('TELEGRAM_MANAGER_CHAT_ID');

    if (!botToken || !managerId) {
      this.logger.warn('TELEGRAM_BOT_TOKEN или TELEGRAM_MANAGER_CHAT_ID не настроены');
      return;
    }

    const urgencyEmoji = { normal: '🔔', high: '🔴', critical: '🚨' }[urgency];

    const pushText = [
      `${urgencyEmoji} <b>Эскалация из чата</b>`,
      `Компания: <b>${ctx.companyName}</b>`,
      `Контакт: ${ctx.contactName}`,
      `Причина: ${reason}`,
      '',
      `Сообщение клиента:`,
      `"${userMessage.slice(0, 200)}${userMessage.length > 200 ? '…' : ''}"`,
    ].join('\n');

    try {
      await sendTelegramPush(botToken, managerId, pushText);
      this.logger.log(
        `[chat:${companyId}] Эскалация отправлена менеджеру (urgency=${urgency})`,
      );
    } catch (err) {
      this.logger.error(`Не удалось отправить Push эскалации: ${err.message}`);
    }
  }

  /**
   * Сформировать WsMessageEvent из сохранённого сообщения.
   */
  toWsEvent(msg: ChatMessage, senderName: string): WsMessageEvent {
    return {
      event: 'message:new',
      data: {
        id:           msg.id,
        senderType:   msg.senderType,
        senderName,
        text:         msg.text,
        cardPayload:  msg.cardPayload,
        attachmentUrl: msg.attachmentUrl,
        createdAt:    msg.createdAt.toISOString(),
      },
    };
  }
}
