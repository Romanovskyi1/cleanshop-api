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
var InvoiceDistributionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceDistributionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const invoice_entity_1 = require("./entities/invoice.entity");
const s3_storage_service_1 = require("./channels/s3-storage.service");
const telegram_delivery_service_1 = require("./channels/telegram-delivery.service");
const email_delivery_service_1 = require("./channels/email-delivery.service");
let InvoiceDistributionService = InvoiceDistributionService_1 = class InvoiceDistributionService {
    constructor(deliveries, s3, telegram, email, config) {
        this.deliveries = deliveries;
        this.s3 = s3;
        this.telegram = telegram;
        this.email = email;
        this.config = config;
        this.logger = new common_1.Logger(InvoiceDistributionService_1.name);
    }
    async distribute(invoice, pdfBuffer, contacts, channels = [
        invoice_entity_1.DeliveryChannel.TELEGRAM_PERSONAL,
        invoice_entity_1.DeliveryChannel.TELEGRAM_GROUP,
        invoice_entity_1.DeliveryChannel.EMAIL,
    ]) {
        this.logger.log(`[invoice:${invoice.id}] Uploading PDF to S3...`);
        const pdfUrl = await this.s3.uploadPdf(pdfBuffer, invoice.invoiceNumber);
        const tgCaption = telegram_delivery_service_1.TelegramDeliveryService.buildCaption({
            invoiceNumber: invoice.invoiceNumber,
            companyName: contacts.companyName,
            totalEur: invoice.totalEur,
            dueDate: invoice.dueDate,
            orderId: invoice.orderId,
        });
        const filename = `${invoice.invoiceNumber}.pdf`;
        this.logger.log(`[invoice:${invoice.id}] Distributing to channels: ${channels.join(', ')}`);
        const tasks = channels.map(channel => this.deliverToChannel(invoice, pdfBuffer, filename, tgCaption, contacts, channel, pdfUrl));
        const results = await Promise.allSettled(tasks);
        const channelResults = results.map((r, i) => {
            if (r.status === 'fulfilled')
                return r.value;
            return {
                channel: channels[i],
                status: 'failed',
                error: r.reason?.message ?? 'Unknown error',
            };
        });
        const allSent = channelResults.every(r => r.status === 'sent');
        if (!allSent) {
            const failed = channelResults.filter(r => r.status === 'failed');
            this.logger.warn(`[invoice:${invoice.id}] ${failed.length} channel(s) failed: ` +
                failed.map(f => `${f.channel}: ${f.error}`).join('; '));
        }
        await this.notifyManagerAboutResult(invoice, contacts, channelResults, pdfUrl);
        return {
            invoiceId: invoice.id,
            pdfUrl,
            channels: channelResults,
            allSent,
        };
    }
    async resend(invoice, pdfBuffer, contacts, channels) {
        let targetChannels = channels;
        if (!targetChannels) {
            const failed = await this.deliveries.find({
                where: { invoiceId: invoice.id, status: invoice_entity_1.DeliveryStatus.FAILED },
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
    async getDeliveryStatus(invoiceId) {
        return this.deliveries.find({
            where: { invoiceId },
            order: { createdAt: 'ASC' },
        });
    }
    async deliverToChannel(invoice, pdfBuffer, filename, tgCaption, contacts, channel, pdfUrl) {
        const delivery = await this.deliveries.save(this.deliveries.create({
            invoiceId: invoice.id,
            channel,
            status: invoice_entity_1.DeliveryStatus.SENT,
        }));
        try {
            let result;
            switch (channel) {
                case invoice_entity_1.DeliveryChannel.TELEGRAM_PERSONAL:
                    if (!contacts.telegramId) {
                        throw new Error('telegramId клиента не задан');
                    }
                    result = await this.telegram.sendToPersonalChat(contacts.telegramId, pdfBuffer, tgCaption, filename);
                    break;
                case invoice_entity_1.DeliveryChannel.TELEGRAM_GROUP:
                    if (!contacts.groupChatId) {
                        this.logger.warn(`[invoice:${invoice.id}] groupChatId не задан — пропуск`);
                        await this.deliveries.update(delivery.id, {
                            status: invoice_entity_1.DeliveryStatus.FAILED,
                            errorMessage: 'groupChatId не настроен для этой компании',
                            sentAt: new Date(),
                        });
                        return { channel, status: 'failed', error: 'groupChatId не настроен' };
                    }
                    result = await this.telegram.sendToGroupChat(contacts.groupChatId, pdfBuffer, tgCaption, filename);
                    break;
                case invoice_entity_1.DeliveryChannel.EMAIL:
                    if (!contacts.email) {
                        throw new Error('Email клиента не задан');
                    }
                    result = await this.email.sendInvoice(contacts.email, pdfBuffer, invoice.invoiceNumber, {
                        companyName: contacts.companyName,
                        contactName: contacts.contactName,
                        orderId: invoice.orderId,
                        totalEur: Number(invoice.totalEur),
                        dueDate: invoice.dueDate,
                        subtotalEur: Number(invoice.subtotalEur),
                        vatRate: Number(invoice.vatRate),
                        vatAmount: Number(invoice.vatAmount),
                    });
                    break;
                default:
                    throw new Error(`Неизвестный канал: ${channel}`);
            }
            if (!result.ok)
                throw new Error(result.error ?? 'Delivery failed');
            await this.deliveries.update(delivery.id, {
                status: invoice_entity_1.DeliveryStatus.SENT,
                sentAt: new Date(),
            });
            this.logger.log(`[invoice:${invoice.id}] Channel ${channel} → SENT`);
            return { channel, status: 'sent' };
        }
        catch (err) {
            await this.deliveries.update(delivery.id, {
                status: invoice_entity_1.DeliveryStatus.FAILED,
                errorMessage: err.message,
                sentAt: new Date(),
            });
            this.logger.error(`[invoice:${invoice.id}] Channel ${channel} → FAILED: ${err.message}`);
            return { channel, status: 'failed', error: err.message };
        }
    }
    async notifyManagerAboutResult(invoice, contacts, results, pdfUrl) {
        const managerChatId = this.config.get('TELEGRAM_MANAGER_CHAT_ID');
        if (!managerChatId)
            return;
        const allSent = results.every(r => r.status === 'sent');
        const failed = results.filter(r => r.status === 'failed');
        const icon = allSent ? '✅' : '⚠️';
        const channelLabels = {
            telegram_personal: 'Личный TG',
            telegram_group: 'Групповой TG',
            email: 'Email',
        };
        const statusLines = results.map(r => `${r.status === 'sent' ? '✓' : '✗'} ${channelLabels[r.channel] ?? r.channel}` +
            (r.error ? ` (${r.error})` : ''));
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
            const token = this.config.get('TELEGRAM_BOT_TOKEN');
            if (!token)
                return;
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: managerChatId,
                    text,
                    parse_mode: 'HTML',
                }),
            });
        }
        catch (err) {
            this.logger.warn(`Не удалось уведомить менеджера: ${err.message}`);
        }
    }
};
exports.InvoiceDistributionService = InvoiceDistributionService;
exports.InvoiceDistributionService = InvoiceDistributionService = InvoiceDistributionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.InvoiceDelivery)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        s3_storage_service_1.S3StorageService,
        telegram_delivery_service_1.TelegramDeliveryService,
        email_delivery_service_1.EmailDeliveryService,
        config_1.ConfigService])
], InvoiceDistributionService);
//# sourceMappingURL=invoice-distribution.service.js.map