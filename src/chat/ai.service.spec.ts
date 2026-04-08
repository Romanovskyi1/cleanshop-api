import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService }        from '@nestjs/config';
import { AiService }            from './ai.service';
import { MessageIntent }        from './entities/chat-message.entity';

// ── Mock Anthropic SDK ────────────────────────────────────────────────────────
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockCtx = {
  companyName:     'CleanService GmbH',
  contactName:     'Klaus Weber',
  languageCode:    'de',
  activeOrders:    [{ id: 4, status: 'building', confirmedDate: '2025-03-18' }],
  pendingPallets:  29,
  pendingInvoices: 1,
  recentProducts:  [{ sku: 'GC-028-5L', name: 'Dish Gel 5L' }],
};

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('AiService', () => {
  let service: AiService;
  let configService: jest.Mocked<ConfigService>;
  let anthropicCreate: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'ANTHROPIC_API_KEY') return 'sk-ant-test';
              throw new Error(`Missing: ${key}`);
            }),
            get: jest.fn((key: string, def?: string) => {
              if (key === 'AI_MODEL') return 'claude-sonnet-4-20250514';
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    configService = module.get(ConfigService);

    // Достаём mock метода create
    const Anthropic = require('@anthropic-ai/sdk').default;
    anthropicCreate = new Anthropic().messages.create;
    (service as any).claude = { messages: { create: anthropicCreate } };
  });

  afterEach(() => jest.clearAllMocks());

  // ── parseResponse ──────────────────────────────────────────────────────────

  describe('parseResponse', () => {
    it('парсит intent-блок корректно', () => {
      const raw = `
\`\`\`intent
{ "intent": "transactional", "confidence": 0.92 }
\`\`\`
Конечно! Вот цена на GreenClean Гель 5L.
      `.trim();

      const result = service.parseResponse(raw);
      expect(result.intent).toBe(MessageIntent.TRANSACTIONAL);
      expect(result.confidence).toBe(0.92);
      expect(result.text).toBe('Конечно! Вот цена на GreenClean Гель 5L.');
    });

    it('парсит card-блок и возвращает payload', () => {
      const raw = `
\`\`\`intent
{ "intent": "informational", "confidence": 0.88 }
\`\`\`
GreenClean Гель для посуды 5L (арт. GC-028-5L):
\`\`\`card
{
  "type": "price_card",
  "sku": "GC-028-5L",
  "productName": "GreenClean Dish Gel 5L",
  "pricePerUnit": 12.40,
  "pricePerBox": 297.60,
  "unitsPerBox": 24,
  "currency": "EUR"
}
\`\`\`
      `.trim();

      const result = service.parseResponse(raw);
      expect(result.cardPayload).not.toBeNull();
      expect(result.cardPayload!['type']).toBe('price_card');
      expect(result.cardPayload!['sku']).toBe('GC-028-5L');
      expect(result.text).toContain('GreenClean Гель для посуды');
      expect(result.text).not.toContain('```card');
    });

    it('парсит escalate-блок и форсирует intent=escalate', () => {
      const raw = `
\`\`\`intent
{ "intent": "complaint", "confidence": 0.95 }
\`\`\`
Понимаю вашу ситуацию. Передаю запрос менеджеру.
\`\`\`escalate
{ "reason": "Client reports damaged goods on order #4", "urgency": "high" }
\`\`\`
      `.trim();

      const result = service.parseResponse(raw);
      expect(result.intent).toBe(MessageIntent.ESCALATE);
      expect(result.escalation).not.toBeNull();
      expect(result.escalation!.urgency).toBe('high');
      expect(result.text).toContain('Передаю запрос менеджеру');
      expect(result.text).not.toContain('```escalate');
    });

    it('обрабатывает ответ без JSON-блоков', () => {
      const raw = 'Добро пожаловать! Чем могу помочь?';
      const result = service.parseResponse(raw);

      expect(result.text).toBe(raw);
      expect(result.intent).toBe(MessageIntent.INFORMATIONAL);
      expect(result.cardPayload).toBeNull();
      expect(result.escalation).toBeNull();
    });

    it('не падает при невалидном JSON в блоках', () => {
      const raw = `
\`\`\`intent
{ INVALID JSON }
\`\`\`
Текст ответа.
      `.trim();

      // Не должен кидать исключение
      const result = service.parseResponse(raw);
      expect(result.text).toContain('Текст ответа');
      // intent остаётся дефолтным
      expect(result.intent).toBe(MessageIntent.INFORMATIONAL);
    });

    it('убирает лишние пустые строки из text', () => {
      const raw = `
\`\`\`intent
{ "intent": "informational", "confidence": 0.8 }
\`\`\`


Первый абзац.


Второй абзац.


      `.trim();

      const result = service.parseResponse(raw);
      // Не должно быть более двух подряд идущих переносов
      expect(result.text).not.toMatch(/\n{3,}/);
    });
  });

  // ── isAiMode ───────────────────────────────────────────────────────────────

  describe('isAiMode', () => {
    const mockDate = (isoString: string) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(isoString));
    };

    afterEach(() => jest.useRealTimers());

    it('AI-режим в субботу', () => {
      mockDate('2025-03-22T11:00:00Z'); // суббота 11:00 UTC = 12:00 CET
      expect(service.isAiMode()).toBe(true);
    });

    it('AI-режим в воскресенье', () => {
      mockDate('2025-03-23T09:00:00Z'); // воскресенье
      expect(service.isAiMode()).toBe(true);
    });

    it('AI-режим ночью в пятницу (до 10:00 CET)', () => {
      mockDate('2025-03-21T07:00:00Z'); // пятница 07:00 UTC = 08:00 CET
      expect(service.isAiMode()).toBe(true);
    });

    it('Human-режим в рабочее время (10-15 CET)', () => {
      mockDate('2025-03-20T11:30:00Z'); // четверг 11:30 UTC = 12:30 CET
      expect(service.isAiMode()).toBe(false);
    });

    it('AI-режим после 15:00 CET', () => {
      mockDate('2025-03-20T15:00:00Z'); // четверг 15:00 UTC = 16:00 CET
      expect(service.isAiMode()).toBe(true);
    });
  });

  // ── chat (integration) ─────────────────────────────────────────────────────

  describe('chat', () => {
    it('вызывает Claude API и возвращает разобранный ответ', async () => {
      const mockRaw = `
\`\`\`intent
{ "intent": "informational", "confidence": 0.9 }
\`\`\`
GreenClean Гель 5L стоит € 12,40 за штуку.
      `.trim();

      anthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: mockRaw }],
      });

      const result = await service.chat(
        'Сколько стоит GreenClean Гель 5L?',
        [],
        mockCtx,
      );

      expect(result.text).toContain('12,40');
      expect(result.intent).toBe(MessageIntent.INFORMATIONAL);
      expect(anthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model:   'claude-sonnet-4-20250514',
          system:  expect.stringContaining('CleanService GmbH'),
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
      );
    });

    it('возвращает fallback при ошибке Claude API', async () => {
      anthropicCreate.mockRejectedValue(new Error('API timeout'));

      const result = await service.chat('Тест', [], mockCtx);

      expect(result.intent).toBe(MessageIntent.ESCALATE);
      expect(result.escalation).not.toBeNull();
      expect(result.escalation!.urgency).toBe('high');
    });
  });
});
