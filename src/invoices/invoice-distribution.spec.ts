// Mock node-fetch (ESM-only v3) before any imports that transitively load it
jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import { Test, TestingModule }  from '@nestjs/testing';
import { getRepositoryToken }   from '@nestjs/typeorm';
import { ConfigService }        from '@nestjs/config';

import { InvoiceDistributionService } from './invoice-distribution.service';
import { InvoiceDelivery, DeliveryChannel, DeliveryStatus } from './entities/invoice.entity';
import { S3StorageService }        from './channels/s3-storage.service';
import { TelegramDeliveryService } from './channels/telegram-delivery.service';
import { EmailDeliveryService }    from './channels/email-delivery.service';
import { Invoice, InvoiceStatus }  from './entities/invoice.entity';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return Object.assign(new Invoice(), {
    id:            1,
    invoiceNumber: 'INV-2025-0047',
    orderId:       4,
    companyId:     1,
    createdBy:     10,
    issuedAt:      new Date('2025-03-10'),
    dueDate:       '2025-04-09',
    subtotalEur:   15960,
    vatRate:       23,
    vatAmount:     3670.80,
    totalEur:      19630.80,
    status:        InvoiceStatus.PENDING,
    pdfUrl:        null,
    originalFilename: 'INV-2025-0047.pdf',
    paidAt:        null,
    createdAt:     new Date(),
    updatedAt:     new Date(),
    ...overrides,
  });
}

const mockContacts = {
  companyName:  'CleanService GmbH',
  contactName:  'Klaus Weber',
  telegramId:   '123456789',
  groupChatId:  '-1001234567890',
  email:        'k.weber@cleanservice.pl',
};

const pdfBuffer = Buffer.from('%PDF-1.4 fake content');

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('InvoiceDistributionService', () => {
  let service: InvoiceDistributionService;
  let s3Mock:        jest.Mocked<S3StorageService>;
  let telegramMock:  jest.Mocked<TelegramDeliveryService>;
  let emailMock:     jest.Mocked<EmailDeliveryService>;
  let deliveryRepo:  { create: jest.Mock; save: jest.Mock; update: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    deliveryRepo = {
      create: jest.fn().mockImplementation(d => ({ id: 1, ...d })),
      save:   jest.fn().mockImplementation(d => Promise.resolve({ id: 1, ...d })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      find:   jest.fn().mockResolvedValue([]),
    };

    s3Mock = {
      uploadPdf:       jest.fn().mockResolvedValue('https://cdn.example.com/invoices/2025/INV-2025-0047.pdf'),
      uploadFromStream: jest.fn(),
      downloadPdf:     jest.fn().mockResolvedValue(pdfBuffer),
      getPresignedUrl: jest.fn().mockResolvedValue('https://presigned.url'),
    } as any;

    telegramMock = {
      sendToPersonalChat: jest.fn().mockResolvedValue({ ok: true, messageId: 42 }),
      sendToGroupChat:    jest.fn().mockResolvedValue({ ok: true, messageId: 43 }),
      notifyManager:      jest.fn().mockResolvedValue({ ok: true }),
    } as any;

    emailMock = {
      sendInvoice: jest.fn().mockResolvedValue({ ok: true, messageId: 'sg-msg-001' }),
    } as any;

    const configMock = {
      get:        jest.fn().mockImplementation((key: string, def?: string) => {
        const map: Record<string, string> = {
          TELEGRAM_BOT_TOKEN:    'test-token',
          TELEGRAM_MANAGER_CHAT_ID: '-999',
        };
        return map[key] ?? def;
      }),
      getOrThrow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceDistributionService,
        { provide: getRepositoryToken(InvoiceDelivery), useValue: deliveryRepo },
        { provide: S3StorageService,        useValue: s3Mock },
        { provide: TelegramDeliveryService, useValue: telegramMock },
        { provide: EmailDeliveryService,    useValue: emailMock },
        { provide: ConfigService,           useValue: configMock },
      ],
    }).compile();

    service = module.get<InvoiceDistributionService>(InvoiceDistributionService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── distribute ──────────────────────────────────────────────────────────────

  describe('distribute', () => {
    it('загружает PDF в S3 и рассылает по трём каналам параллельно', async () => {
      const invoice = makeInvoice();
      const result  = await service.distribute(invoice, pdfBuffer, mockContacts);

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
      const result  = await service.distribute(invoice, pdfBuffer, mockContacts);

      expect(result.allSent).toBe(false);

      const personalResult = result.channels.find(
        c => c.channel === DeliveryChannel.TELEGRAM_PERSONAL,
      );
      expect(personalResult?.status).toBe('failed');
      expect(personalResult?.error).toContain('Chat not found');

      // Остальные два канала успешны
      const others = result.channels.filter(c => c.channel !== DeliveryChannel.TELEGRAM_PERSONAL);
      expect(others.every(c => c.status === 'sent')).toBe(true);
    });

    it('пропускает TELEGRAM_GROUP если groupChatId не задан', async () => {
      const contacts = { ...mockContacts, groupChatId: null };
      const invoice  = makeInvoice();
      const result   = await service.distribute(invoice, pdfBuffer, contacts, [
        DeliveryChannel.TELEGRAM_PERSONAL,
        DeliveryChannel.TELEGRAM_GROUP,
      ]);

      expect(telegramMock.sendToGroupChat).not.toHaveBeenCalled();
      const groupResult = result.channels.find(
        c => c.channel === DeliveryChannel.TELEGRAM_GROUP,
      );
      expect(groupResult?.status).toBe('failed');
    });

    it('рассылает только по указанным каналам', async () => {
      const invoice = makeInvoice();
      await service.distribute(
        invoice, pdfBuffer, mockContacts,
        [DeliveryChannel.EMAIL],
      );

      expect(telegramMock.sendToPersonalChat).not.toHaveBeenCalled();
      expect(telegramMock.sendToGroupChat).not.toHaveBeenCalled();
      expect(emailMock.sendInvoice).toHaveBeenCalledTimes(1);
    });

    it('сохраняет delivery-записи в БД для каждого канала', async () => {
      const invoice = makeInvoice();
      await service.distribute(invoice, pdfBuffer, mockContacts);

      // 3 вызова create + 3 вызова update (по одному на канал)
      expect(deliveryRepo.save).toHaveBeenCalledTimes(3);
      expect(deliveryRepo.update).toHaveBeenCalledTimes(3);
    });
  });

  // ── TelegramDeliveryService.buildCaption ────────────────────────────────────

  describe('TelegramDeliveryService.buildCaption', () => {
    it('формирует корректный caption с суммой и датой', () => {
      const caption = TelegramDeliveryService.buildCaption({
        invoiceNumber: 'INV-2025-0047',
        companyName:   'CleanService GmbH',
        totalEur:      19630.80,
        dueDate:       '2025-04-09',
        orderId:       4,
      });

      expect(caption).toContain('INV-2025-0047');
      expect(caption).toContain('CleanService GmbH');
      expect(caption).toContain('19.630,80');
      expect(caption).toContain('#4');
    });
  });
});
