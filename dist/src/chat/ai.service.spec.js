"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const config_1 = require("@nestjs/config");
const ai_service_1 = require("./ai.service");
const chat_message_entity_1 = require("./entities/chat-message.entity");
jest.mock('@anthropic-ai/sdk', () => ({
    default: jest.fn().mockImplementation(() => ({
        messages: {
            create: jest.fn(),
        },
    })),
}));
const mockCtx = {
    companyName: 'CleanService GmbH',
    contactName: 'Klaus Weber',
    languageCode: 'de',
    activeOrders: [{ id: 4, status: 'building', confirmedDate: '2025-03-18' }],
    pendingPallets: 29,
    pendingInvoices: 1,
    recentProducts: [{ sku: 'GC-028-5L', name: 'Dish Gel 5L' }],
};
describe('AiService', () => {
    let service;
    let configService;
    let anthropicCreate;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                ai_service_1.AiService,
                {
                    provide: config_1.ConfigService,
                    useValue: {
                        getOrThrow: jest.fn((key) => {
                            if (key === 'ANTHROPIC_API_KEY')
                                return 'sk-ant-test';
                            throw new Error(`Missing: ${key}`);
                        }),
                        get: jest.fn((key, def) => {
                            if (key === 'AI_MODEL')
                                return 'claude-sonnet-4-20250514';
                            return def;
                        }),
                    },
                },
            ],
        }).compile();
        service = module.get(ai_service_1.AiService);
        configService = module.get(config_1.ConfigService);
        const Anthropic = require('@anthropic-ai/sdk').default;
        anthropicCreate = new Anthropic().messages.create;
        service.claude = { messages: { create: anthropicCreate } };
    });
    afterEach(() => jest.clearAllMocks());
    describe('parseResponse', () => {
        it('парсит intent-блок корректно', () => {
            const raw = `
\`\`\`intent
{ "intent": "transactional", "confidence": 0.92 }
\`\`\`
Конечно! Вот цена на GreenClean Гель 5L.
      `.trim();
            const result = service.parseResponse(raw);
            expect(result.intent).toBe(chat_message_entity_1.MessageIntent.TRANSACTIONAL);
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
            expect(result.cardPayload['type']).toBe('price_card');
            expect(result.cardPayload['sku']).toBe('GC-028-5L');
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
            expect(result.intent).toBe(chat_message_entity_1.MessageIntent.ESCALATE);
            expect(result.escalation).not.toBeNull();
            expect(result.escalation.urgency).toBe('high');
            expect(result.text).toContain('Передаю запрос менеджеру');
            expect(result.text).not.toContain('```escalate');
        });
        it('обрабатывает ответ без JSON-блоков', () => {
            const raw = 'Добро пожаловать! Чем могу помочь?';
            const result = service.parseResponse(raw);
            expect(result.text).toBe(raw);
            expect(result.intent).toBe(chat_message_entity_1.MessageIntent.INFORMATIONAL);
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
            const result = service.parseResponse(raw);
            expect(result.text).toContain('Текст ответа');
            expect(result.intent).toBe(chat_message_entity_1.MessageIntent.INFORMATIONAL);
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
            expect(result.text).not.toMatch(/\n{3,}/);
        });
    });
    describe('isAiMode', () => {
        const mockDate = (isoString) => {
            jest.spyOn(global, 'Date').mockImplementation((...args) => args.length ? new Date(...args) : new Date(isoString));
        };
        afterEach(() => jest.restoreAllMocks());
        it('AI-режим в субботу', () => {
            mockDate('2025-03-22T11:00:00Z');
            expect(service.isAiMode()).toBe(true);
        });
        it('AI-режим в воскресенье', () => {
            mockDate('2025-03-23T09:00:00Z');
            expect(service.isAiMode()).toBe(true);
        });
        it('AI-режим ночью в пятницу (до 10:00 CET)', () => {
            mockDate('2025-03-21T07:00:00Z');
            expect(service.isAiMode()).toBe(true);
        });
        it('Human-режим в рабочее время (10-15 CET)', () => {
            mockDate('2025-03-20T11:30:00Z');
            expect(service.isAiMode()).toBe(false);
        });
        it('AI-режим после 15:00 CET', () => {
            mockDate('2025-03-20T15:00:00Z');
            expect(service.isAiMode()).toBe(true);
        });
    });
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
            const result = await service.chat('Сколько стоит GreenClean Гель 5L?', [], mockCtx);
            expect(result.text).toContain('12,40');
            expect(result.intent).toBe(chat_message_entity_1.MessageIntent.INFORMATIONAL);
            expect(anthropicCreate).toHaveBeenCalledWith(expect.objectContaining({
                model: 'claude-sonnet-4-20250514',
                system: expect.stringContaining('CleanService GmbH'),
                messages: expect.arrayContaining([
                    expect.objectContaining({ role: 'user' }),
                ]),
            }));
        });
        it('возвращает fallback при ошибке Claude API', async () => {
            anthropicCreate.mockRejectedValue(new Error('API timeout'));
            const result = await service.chat('Тест', [], mockCtx);
            expect(result.intent).toBe(chat_message_entity_1.MessageIntent.ESCALATE);
            expect(result.escalation).not.toBeNull();
            expect(result.escalation.urgency).toBe('high');
        });
    });
});
//# sourceMappingURL=ai.service.spec.js.map