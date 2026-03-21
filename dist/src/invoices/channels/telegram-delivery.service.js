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
var TelegramDeliveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramDeliveryService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const form_data_1 = require("form-data");
const node_fetch_1 = require("node-fetch");
let TelegramDeliveryService = TelegramDeliveryService_1 = class TelegramDeliveryService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(TelegramDeliveryService_1.name);
        const token = config.getOrThrow('TELEGRAM_BOT_TOKEN');
        this.baseUrl = `https://api.telegram.org/bot${token}`;
    }
    async sendToPersonalChat(telegramId, pdfBuffer, caption, filename) {
        return this.sendDocument(telegramId, pdfBuffer, caption, filename);
    }
    async sendToGroupChat(groupChatId, pdfBuffer, caption, filename) {
        return this.sendDocument(groupChatId, pdfBuffer, caption, filename);
    }
    async notifyManager(chatId, text) {
        return this.sendMessage(chatId, text);
    }
    async sendDocument(chatId, buffer, caption, filename) {
        try {
            const form = new form_data_1.default();
            form.append('chat_id', chatId);
            form.append('caption', caption, { contentType: 'text/plain' });
            form.append('parse_mode', 'HTML');
            form.append('document', buffer, {
                filename,
                contentType: 'application/pdf',
            });
            const res = await (0, node_fetch_1.default)(`${this.baseUrl}/sendDocument`, {
                method: 'POST',
                body: form,
            });
            const body = await res.json();
            if (!body.ok) {
                this.logger.warn(`TG sendDocument failed to ${chatId}: ${body.description}`);
                return { ok: false, error: body.description };
            }
            this.logger.log(`TG sendDocument OK → chatId=${chatId} msgId=${body.result.message_id}`);
            return { ok: true, messageId: body.result.message_id };
        }
        catch (err) {
            this.logger.error(`TG sendDocument exception: ${err.message}`);
            return { ok: false, error: err.message };
        }
    }
    async sendMessage(chatId, text) {
        try {
            const res = await (0, node_fetch_1.default)(`${this.baseUrl}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
            });
            const body = await res.json();
            if (!body.ok) {
                return { ok: false, error: body.description };
            }
            return { ok: true, messageId: body.result.message_id };
        }
        catch (err) {
            return { ok: false, error: err.message };
        }
    }
    static buildCaption(params) {
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
};
exports.TelegramDeliveryService = TelegramDeliveryService;
exports.TelegramDeliveryService = TelegramDeliveryService = TelegramDeliveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TelegramDeliveryService);
//# sourceMappingURL=telegram-delivery.service.js.map