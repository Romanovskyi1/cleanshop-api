"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sdk_1 = require("@anthropic-ai/sdk");
const chat_message_entity_1 = require("./entities/chat-message.entity");
const system_prompt_1 = require("./prompts/system-prompt");
const HISTORY_WINDOW = 20;
const API_TIMEOUT_MS = 15_000;
let AiService = AiService_1 = class AiService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(AiService_1.name);
        this.claude = new sdk_1.default({
            apiKey: this.config.getOrThrow('ANTHROPIC_API_KEY'),
            timeout: API_TIMEOUT_MS,
        });
        this.model = this.config.get('AI_MODEL', 'claude-sonnet-4-20250514');
    }
    async chat(userMessage, history, ctx) {
        const systemPrompt = (0, system_prompt_1.buildSystemPrompt)(ctx);
        const trimmedHistory = history.slice(-HISTORY_WINDOW);
        const messages = [
            ...trimmedHistory.map(m => ({
                role: m.role,
                content: m.content,
            })),
            { role: 'user', content: userMessage },
        ];
        try {
            const response = await this.claude.messages.create({
                model: this.model,
                max_tokens: 1024,
                system: systemPrompt,
                messages,
            });
            const rawText = response.content
                .filter(b => b.type === 'text')
                .map(b => b.text)
                .join('');
            return this.parseResponse(rawText);
        }
        catch (err) {
            this.logger.error(`Claude API error: ${err.message}`);
            return {
                text: this.getFallbackText(ctx.languageCode),
                intent: chat_message_entity_1.MessageIntent.ESCALATE,
                confidence: 1,
                cardPayload: null,
                escalation: {
                    reason: 'Claude API unavailable — automatic escalation',
                    urgency: 'high',
                },
            };
        }
    }
    parseResponse(raw) {
        let text = raw;
        let intent = chat_message_entity_1.MessageIntent.INFORMATIONAL;
        let confidence = 0.8;
        let cardPayload = null;
        let escalation = null;
        const intentMatch = raw.match(/```intent\s*([\s\S]*?)```/);
        if (intentMatch) {
            try {
                const parsed = JSON.parse(intentMatch[1].trim());
                intent = parsed.intent ?? intent;
                confidence = parsed.confidence ?? confidence;
            }
            catch {
                this.logger.warn('Не удалось разобрать intent-блок');
            }
            text = text.replace(intentMatch[0], '').trim();
        }
        const cardMatch = raw.match(/```card\s*([\s\S]*?)```/);
        if (cardMatch) {
            try {
                cardPayload = JSON.parse(cardMatch[1].trim());
            }
            catch {
                this.logger.warn('Не удалось разобрать card-блок');
            }
            text = text.replace(cardMatch[0], '').trim();
        }
        const escalateMatch = raw.match(/```escalate\s*([\s\S]*?)```/);
        if (escalateMatch) {
            try {
                const parsed = JSON.parse(escalateMatch[1].trim());
                escalation = {
                    reason: parsed.reason ?? 'Requires manager attention',
                    urgency: parsed.urgency ?? 'normal',
                };
                intent = chat_message_entity_1.MessageIntent.ESCALATE;
            }
            catch {
                this.logger.warn('Не удалось разобрать escalate-блок');
            }
            text = text.replace(escalateMatch[0], '').trim();
        }
        text = text.replace(/\n{3,}/g, '\n\n').trim();
        return { text, intent, confidence, cardPayload, escalation };
    }
    isAiMode() {
        const now = new Date();
        const cetOffset = this.getCETOffset(now);
        const cetHour = (now.getUTCHours() + cetOffset) % 24;
        const cetDay = new Date(now.getTime() + cetOffset * 3600_000).getUTCDay();
        const isWeekend = cetDay === 0 || cetDay === 6;
        const isWorkHour = cetHour >= 10 && cetHour < 15;
        return isWeekend || !isWorkHour;
    }
    getChatStatus() {
        if (this.isAiMode()) {
            return { mode: 'ai' };
        }
        return { mode: 'human', agentName: 'Support team' };
    }
    getCETOffset(date) {
        const year = date.getUTCFullYear();
        const dstStart = this.lastSunday(year, 2);
        const dstEnd = this.lastSunday(year, 9);
        const isDST = date >= dstStart && date < dstEnd;
        return isDST ? 2 : 1;
    }
    lastSunday(year, month) {
        const d = new Date(Date.UTC(year, month + 1, 0));
        d.setUTCDate(d.getUTCDate() - d.getUTCDay());
        d.setUTCHours(1, 0, 0, 0);
        return d;
    }
    getFallbackText(lang = 'en') {
        const msgs = {
            ru: 'Сейчас не могу ответить — передаю запрос менеджеру. Ответим в ближайшее время.',
            en: 'I\'m unable to respond right now. Escalating to our team — we\'ll get back to you shortly.',
            de: 'Im Moment kann ich nicht antworten. Ihr Anliegen wird weitergeleitet.',
            pl: 'Nie mogę teraz odpowiedzieć. Przekazuję zapytanie do zespołu.',
        };
        return msgs[lang] ?? msgs['en'];
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map