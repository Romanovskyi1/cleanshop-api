import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }       from '@nestjs/config';
import Anthropic               from '@anthropic-ai/sdk';
import { MessageIntent }       from './entities/chat-message.entity';
import { ParsedAiResponse }    from './dto/chat.dto';
import { buildSystemPrompt, ClientContext } from './prompts/system-prompt';

// Максимум сообщений в истории передаваемых в API (окно контекста)
const HISTORY_WINDOW = 20;

// Таймаут запроса к Claude API (мс)
const API_TIMEOUT_MS = 15_000;

interface HistoryMessage {
  role:    'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly claude: Anthropic;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.claude = new Anthropic({
      apiKey:  this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
      timeout: API_TIMEOUT_MS,
    });
    this.model = this.config.get<string>('AI_MODEL', 'claude-sonnet-4-20250514');
  }

  /**
   * Отправить сообщение клиента в Claude и получить разобранный ответ.
   *
   * @param userMessage  — текст от клиента
   * @param history      — предыдущие сообщения (user/assistant)
   * @param ctx          — контекст клиента из БД
   */
  async chat(
    userMessage: string,
    history:     HistoryMessage[],
    ctx:         ClientContext,
  ): Promise<ParsedAiResponse> {
    const systemPrompt = buildSystemPrompt(ctx);

    // Ограничиваем историю последними N сообщениями
    const trimmedHistory = history.slice(-HISTORY_WINDOW);

    const messages: Anthropic.MessageParam[] = [
      ...trimmedHistory.map(m => ({
        role:    m.role,
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.claude.messages.create({
        model:      this.model,
        max_tokens: 1024,
        system:     systemPrompt,
        messages,
      });

      const rawText = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('');

      return this.parseResponse(rawText);

    } catch (err) {
      this.logger.error(`Claude API error: ${err.message}`);

      // Fallback — вежливый ответ что что-то пошло не так
      return {
        text:       this.getFallbackText(ctx.languageCode),
        intent:     MessageIntent.ESCALATE,
        confidence: 1,
        cardPayload: null,
        escalation: {
          reason:  'Claude API unavailable — automatic escalation',
          urgency: 'high',
        },
      };
    }
  }

  /**
   * Разобрать ответ Claude:
   * - извлечь intent-блок
   * - извлечь card-блок (если есть)
   * - извлечь escalate-блок (если есть)
   * - очистить текст от JSON-блоков
   */
  parseResponse(raw: string): ParsedAiResponse {
    let text        = raw;
    let intent      = MessageIntent.INFORMATIONAL;
    let confidence  = 0.8;
    let cardPayload: Record<string, unknown> | null = null;
    let escalation: ParsedAiResponse['escalation'] = null;

    // ── intent-блок ──────────────────────────────────────────────────────
    const intentMatch = raw.match(/```intent\s*([\s\S]*?)```/);
    if (intentMatch) {
      try {
        const parsed = JSON.parse(intentMatch[1].trim());
        intent     = parsed.intent     ?? intent;
        confidence = parsed.confidence ?? confidence;
      } catch {
        this.logger.warn('Не удалось разобрать intent-блок');
      }
      text = text.replace(intentMatch[0], '').trim();
    }

    // ── card-блок ────────────────────────────────────────────────────────
    const cardMatch = raw.match(/```card\s*([\s\S]*?)```/);
    if (cardMatch) {
      try {
        cardPayload = JSON.parse(cardMatch[1].trim());
      } catch {
        this.logger.warn('Не удалось разобрать card-блок');
      }
      text = text.replace(cardMatch[0], '').trim();
    }

    // ── escalate-блок ────────────────────────────────────────────────────
    const escalateMatch = raw.match(/```escalate\s*([\s\S]*?)```/);
    if (escalateMatch) {
      try {
        const parsed = JSON.parse(escalateMatch[1].trim());
        escalation = {
          reason:  parsed.reason  ?? 'Requires manager attention',
          urgency: parsed.urgency ?? 'normal',
        };
        intent = MessageIntent.ESCALATE;
      } catch {
        this.logger.warn('Не удалось разобрать escalate-блок');
      }
      text = text.replace(escalateMatch[0], '').trim();
    }

    // Убираем артефакты — двойные пустые строки
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    return { text, intent, confidence, cardPayload, escalation };
  }

  /**
   * Проверить активен ли AI-режим прямо сейчас.
   * Рабочее время менеджера: 10:00–15:00 CET, пн–пт.
   */
  isAiMode(): boolean {
    const now = new Date();

    // Получаем время по CET (UTC+1 зима / UTC+2 лето)
    const cetOffset  = this.getCETOffset(now);
    const cetHour    = (now.getUTCHours() + cetOffset) % 24;
    const cetDay     = new Date(
      now.getTime() + cetOffset * 3600_000,
    ).getUTCDay(); // 0=вс, 6=сб

    const isWeekend  = cetDay === 0 || cetDay === 6;
    const isWorkHour = cetHour >= 10 && cetHour < 15;

    return isWeekend || !isWorkHour;
  }

  /** Текущий статус для клиентского UI */
  getChatStatus(): { mode: 'ai' | 'human'; agentName?: string } {
    if (this.isAiMode()) {
      return { mode: 'ai' };
    }
    return { mode: 'human', agentName: 'Support team' };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /** Определить смещение CET (учитывает летнее время ЕС) */
  private getCETOffset(date: Date): number {
    // Европейское летнее время: последнее воскресенье марта → последнее воскресенье октября
    const year       = date.getUTCFullYear();
    const dstStart   = this.lastSunday(year, 2);  // март (0-indexed)
    const dstEnd     = this.lastSunday(year, 9);  // октябрь
    const isDST      = date >= dstStart && date < dstEnd;
    return isDST ? 2 : 1;
  }

  private lastSunday(year: number, month: number): Date {
    const d = new Date(Date.UTC(year, month + 1, 0)); // последний день месяца
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());     // откатить до воскресенья
    d.setUTCHours(1, 0, 0, 0);                        // 01:00 UTC = переключение
    return d;
  }

  private getFallbackText(lang = 'en'): string {
    const msgs: Record<string, string> = {
      ru: 'Сейчас не могу ответить — передаю запрос менеджеру. Ответим в ближайшее время.',
      en: 'I\'m unable to respond right now. Escalating to our team — we\'ll get back to you shortly.',
      de: 'Im Moment kann ich nicht antworten. Ihr Anliegen wird weitergeleitet.',
      pl: 'Nie mogę teraz odpowiedzieć. Przekazuję zapytanie do zespołu.',
    };
    return msgs[lang] ?? msgs['en'];
  }
}
