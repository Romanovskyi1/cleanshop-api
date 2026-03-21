"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const invoice_distribution_service_1 = require("./invoice-distribution.service");
const invoice_entity_1 = require("./entities/invoice.entity");
const s3_storage_service_1 = require("./channels/s3-storage.service");
const telegram_delivery_service_1 = require("./channels/telegram-delivery.service");
const email_delivery_service_1 = require("./channels/email-delivery.service");
const invoice_entity_2 = require("./entities/invoice.entity");
function makeInvoice(overrides = {}) {
    return Object.assign(new invoice_entity_2.Invoice(), {
        id: 1,
        invoiceNumber: 'INV-2025-0047',
        orderId: 4,
        companyId: 1,
        createdBy: 10,
        issuedAt: new Date('2025-03-10'),
        dueDate: '2025-04-09',
        subtotalEur: 15960,
        vatRate: 23,
        vatAmount: 3670.80,
        totalEur: 19630.80,
        status: invoice_entity_2.InvoiceStatus.PENDING,
        pdfUrl: null,
        originalFilename: 'INV-2025-0047.pdf',
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });
}
const mockContacts = {
    companyName: 'CleanService GmbH',
    contactName: 'Klaus Weber',
    telegramId: '123456789',
    groupChatId: '-1001234567890',
    email: 'k.weber@cleanservice.pl',
};
const pdfBuffer = Buffer.from('%PDF-1.4 fake content');
describe('InvoiceDistributionService', () => {
    let service;
    let s3Mock;
    let telegramMock;
    let emailMock;
    let deliveryRepo;
    beforeEach(async () => {
        deliveryRepo = {
            create: jest.fn().mockImplementation(d => ({ id: 1, ...d })),
            save: jest.fn().mockImplementation(d => Promise.resolve({ id: 1, ...d })),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            find: jest.fn().mockResolvedValue([]),
        };
        s3Mock = {
            uploadPdf: jest.fn().mockResolvedValue('https://cdn.example.com/invoices/2025/INV-2025-0047.pdf'),
            uploadFromStream: jest.fn(),
            downloadPdf: jest.fn().mockResolvedValue(pdfBuffer),
            getPresignedUrl: jest.fn().mockResolvedValue('https://presigned.url'),
        };
        telegramMock = {
            sendToPersonalChat: jest.fn().mockResolvedValue({ ok: true, messageId: 42 }),
            sendToGroupChat: jest.fn().mockResolvedValue({ ok: true, messageId: 43 }),
            notifyManager: jest.fn().mockResolvedValue({ ok: true }),
        };
        emailMock = {
            sendInvoice: jest.fn().mockResolvedValue({ ok: true, messageId: 'sg-msg-001' }),
        };
        const configMock = {
            get: jest.fn().mockImplementation((key, def) => {
                const map = {
                    TELEGRAM_BOT_TOKEN: 'test-token',
                    TELEGRAM_MANAGER_CHAT_ID: '-999',
                };
                return map[key] ?? def;
            }),
            getOrThrow: jest.fn(),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                invoice_distribution_service_1.InvoiceDistributionService,
                { provide: (0, typeorm_1.getRepositoryToken)(invoice_entity_1.InvoiceDelivery), useValue: deliveryRepo },
                { provide: s3_storage_service_1.S3StorageService, useValue: s3Mock },
                { provide: telegram_delivery_service_1.TelegramDeliveryService, useValue: telegramMock },
                { provide: email_delivery_service_1.EmailDeliveryService, useValue: emailMock },
                { provide: config_1.ConfigService, useValue: configMock },
            ],
        }).compile();
        service = module.get(invoice_distribution_service_1.InvoiceDistributionService);
    });
    afterEach(() => jest.clearAllMocks());
    describe('distribute', () => {
        it('загружает PDF в S3 и рассылает по трём каналам параллельно', async () => {
            const invoice = makeInvoice();
            const result = await service.distribute(invoice, pdfBuffer, mockContacts);
            expect(s3Mock.uploadPdf).toHaveBeenCalledWith(pdfBuffer, 'INV-2025-0047');
            expect(telegramMock.sendToPersonalChat).toHaveBeenCalledTimes(1);
            expect(telegramMock.sendToGroupChat).toHaveBeenCalledTimes(1);
            expect(emailMock.sendInvoice).toHaveBeenCalledTimes(1);
            expect(result.allSent).toBe(true);
            expect(result.channels).toHaveLength(3);
            expect(result.pdfUrl).toContain('INV-2025-0047');
        });
        it('помечает канал как failed при ошибке и продолжает остальные', async () => {
            telegramMock.sendToPersonalChat.mockResolvedValueOnce({
                ok: false, error: 'Chat not found',
            });
            const invoice = makeInvoice();
            const result = await service.distribute(invoice, pdfBuffer, mockContacts);
            expect(result.allSent).toBe(false);
            const personalResult = result.channels.find(c => c.channel === invoice_entity_1.DeliveryChannel.TELEGRAM_PERSONAL);
            expect(personalResult?.status).toBe('failed');
            expect(personalResult?.error).toContain('Chat not found');
            const others = result.channels.filter(c => c.channel !== invoice_entity_1.DeliveryChannel.TELEGRAM_PERSONAL);
            expect(others.every(c => c.status === 'sent')).toBe(true);
        });
        it('пропускает TELEGRAM_GROUP если groupChatId не задан', async () => {
            const contacts = { ...mockContacts, groupChatId: null };
            const invoice = makeInvoice();
            const result = await service.distribute(invoice, pdfBuffer, contacts, [
                invoice_entity_1.DeliveryChannel.TELEGRAM_PERSONAL,
                invoice_entity_1.DeliveryChannel.TELEGRAM_GROUP,
            ]);
            expect(telegramMock.sendToGroupChat).not.toHaveBeenCalled();
            const groupResult = result.channels.find(c => c.channel === invoice_entity_1.DeliveryChannel.TELEGRAM_GROUP);
            expect(groupResult?.status).toBe('failed');
        });
        it('рассылает только по указанным каналам', async () => {
            const invoice = makeInvoice();
            await service.distribute(invoice, pdfBuffer, mockContacts, [invoice_entity_1.DeliveryChannel.EMAIL]);
            expect(telegramMock.sendToPersonalChat).not.toHaveBeenCalled();
            expect(telegramMock.sendToGroupChat).not.toHaveBeenCalled();
            expect(emailMock.sendInvoice).toHaveBeenCalledTimes(1);
        });
        it('сохраняет delivery-записи в БД для каждого канала', async () => {
            const invoice = makeInvoice();
            await service.distribute(invoice, pdfBuffer, mockContacts);
            expect(deliveryRepo.save).toHaveBeenCalledTimes(3);
            expect(deliveryRepo.update).toHaveBeenCalledTimes(3);
        });
    });
    describe('TelegramDeliveryService.buildCaption', () => {
        it('формирует корректный caption с суммой и датой', () => {
            const caption = telegram_delivery_service_1.TelegramDeliveryService.buildCaption({
                invoiceNumber: 'INV-2025-0047',
                companyName: 'CleanService GmbH',
                totalEur: 19630.80,
                dueDate: '2025-04-09',
                orderId: 4,
            });
            expect(caption).toContain('INV-2025-0047');
            expect(caption).toContain('CleanService GmbH');
            expect(caption).toContain('19.630,80');
            expect(caption).toContain('#4');
        });
    });
});
//# sourceMappingURL=invoice-distribution.spec.js.map