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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const chat_message_entity_1 = require("./entities/chat-message.entity");
const ai_service_1 = require("./ai.service");
async function sendTelegramPush(botToken, chatId, text) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
        }),
    });
}
let ChatService = ChatService_1 = class ChatService {
    constructor(messages, ai, config) {
        this.messages = messages;
        this.ai = ai;
        this.config = config;
        this.logger = new common_1.Logger(ChatService_1.name);
    }
    async getHistory(companyId, limit = 50, before) {
        const where = { companyId };
        if (before)
            where.id = (0, typeorm_2.LessThan)(before);
        return this.messages.find({
            where,
            order: { createdAt: 'DESC' },
            take: limit,
        }).then(msgs => msgs.reverse());
    }
    async handleClientMessage(companyId, senderId, text, ctx, attachmentUrl = null) {
        const clientMsg = await this.saveMessage({
            companyId,
            senderId,
            senderType: chat_message_entity_1.SenderType.CLIENT,
            text,
            attachmentUrl,
        });
        const isAiMode = this.ai.isAiMode();
        if (!isAiMode) {
            this.logger.log(`[chat:${companyId}] Рабочее время — ждём ответа менеджера`);
            return { clientMsg, replyMsg: null, aiResponse: null, shouldEscalate: false };
        }
        const history = await this.buildAiHistory(companyId);
        const aiResponse = await this.ai.chat(text, history, ctx);
        const replyMsg = await this.saveMessage({
            companyId,
            senderId: null,
            senderType: chat_message_entity_1.SenderType.AI,
            text: aiResponse.text,
            intent: aiResponse.intent,
            cardPayload: aiResponse.cardPayload,
        });
        const shouldEscalate = aiResponse.intent === chat_message_entity_1.MessageIntent.ESCALATE
            || !!aiResponse.escalation;
        if (shouldEscalate) {
            await this.escalateToManager(companyId, ctx, text, aiResponse);
        }
        return { clientMsg, replyMsg, aiResponse, shouldEscalate };
    }
    async saveManagerReply(companyId, managerId, text, attachmentUrl = null) {
        return this.saveMessage({
            companyId,
            senderId: managerId,
            senderType: chat_message_entity_1.SenderType.MANAGER,
            text,
            attachmentUrl,
        });
    }
    async markRead(companyId, messageId) {
        await this.messages.update({ id: messageId, companyId }, { isRead: true });
    }
    getChatStatus() {
        return this.ai.getChatStatus();
    }
    async saveMessage(data) {
        const msg = this.messages.create({
            companyId: data.companyId,
            senderId: data.senderId ?? null,
            senderType: data.senderType,
            text: data.text,
            attachmentUrl: data.attachmentUrl ?? null,
            intent: data.intent ?? null,
            cardPayload: data.cardPayload ?? null,
        });
        return this.messages.save(msg);
    }
    async buildAiHistory(companyId) {
        const msgs = await this.messages.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
            take: 40,
        });
        msgs.reverse();
        const history = [];
        for (const msg of msgs) {
            if (msg.senderType === chat_message_entity_1.SenderType.CLIENT) {
                history.push({ role: 'user', content: msg.text });
            }
            else if (msg.senderType === chat_message_entity_1.SenderType.AI ||
                msg.senderType === chat_message_entity_1.SenderType.MANAGER) {
                history.push({ role: 'assistant', content: msg.text });
            }
        }
        const deduped = [];
        for (const item of history) {
            const last = deduped[deduped.length - 1];
            if (last?.role === item.role) {
                last.content += `\n\n${item.content}`;
            }
            else {
                deduped.push({ ...item });
            }
        }
        if (deduped.length && deduped[0].role !== 'user') {
            deduped.shift();
        }
        return deduped.slice(-20);
    }
    async escalateToManager(companyId, ctx, userMessage, aiResponse) {
        const urgency = aiResponse.escalation?.urgency ?? 'normal';
        const reason = aiResponse.escalation?.reason ?? 'Requires attention';
        const botToken = this.config.get('TELEGRAM_BOT_TOKEN');
        const managerId = this.config.get('TELEGRAM_MANAGER_CHAT_ID');
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
            this.logger.log(`[chat:${companyId}] Эскалация отправлена менеджеру (urgency=${urgency})`);
        }
        catch (err) {
            this.logger.error(`Не удалось отправить Push эскалации: ${err.message}`);
        }
    }
    toWsEvent(msg, senderName) {
        return {
            event: 'message:new',
            data: {
                id: msg.id,
                senderType: msg.senderType,
                senderName,
                text: msg.text,
                cardPayload: msg.cardPayload,
                attachmentUrl: msg.attachmentUrl,
                createdAt: msg.createdAt.toISOString(),
            },
        };
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(chat_message_entity_1.ChatMessage)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        ai_service_1.AiService,
        config_1.ConfigService])
], ChatService);
//# sourceMappingURL=chat.service.js.map