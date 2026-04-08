// src/companies/companies.service.spec.ts
import { Test, TestingModule }    from '@nestjs/testing';
import { getRepositoryToken }     from '@nestjs/typeorm';
import {
  NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';

import { CompaniesService }       from './companies.service';
import { Company, InvoiceTerms }  from './entities/company.entity';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeCompany(overrides: Partial<Company> = {}): Company {
  const company = new Company();
  company.id                  = 1;
  company.name                = 'CleanService sp. z o.o.';
  company.vatNumber           = 'PL9876543210';
  company.address             = 'ul. Marszałkowska 84, Warszawa';
  company.countryCode         = 'PL';
  company.invoiceEmail        = 'invoices@cleanservice.pl';
  company.telegramGroupChatId = '-1001234567890';
  company.primaryContactName  = 'Klaus Weber';
  company.invoiceTerms        = InvoiceTerms.NET_30;
  company.vatRate             = 23.00;
  company.iban                = null;
  company.notes               = null;
  company.isActive            = true;
  company.createdAt           = new Date('2025-01-01');
  company.updatedAt           = new Date('2025-01-01');
  return Object.assign(company, overrides);
}

const mockContact = {
  id: 1, telegramId: '123456789',
  firstName: 'Klaus', lastName: 'Weber',
  displayName: 'Klaus Weber', companyId: 1,
};

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('CompaniesService', () => {
  let service: CompaniesService;
  let repo: {
    find:    jest.Mock;
    findOne: jest.Mock;
    create:  jest.Mock;
    save:    jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      find:    jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create:  jest.fn().mockImplementation(d => ({ ...d })),
      save:    jest.fn().mockImplementation(e => Promise.resolve(e)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: getRepositoryToken(Company), useValue: repo },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('возвращает компанию если найдена', async () => {
      repo.findOne.mockResolvedValue(makeCompany());
      const result = await service.findById(1);
      expect(result.id).toBe(1);
      expect(result.name).toBe('CleanService sp. z o.o.');
    });

    it('выбрасывает NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('создаёт компанию без VAT', async () => {
      const dto = { name: 'Test GmbH', countryCode: 'DE' };
      const company = makeCompany({ name: 'Test GmbH' });
      repo.findOne.mockResolvedValue(null); // VAT не задан — findOne не вызывается
      repo.create.mockReturnValue(company);
      repo.save.mockResolvedValue(company);

      const result = await service.create(dto);
      expect(result.name).toBe('Test GmbH');
    });

    it('выбрасывает ConflictException при дублировании VAT', async () => {
      repo.findOne.mockResolvedValue(makeCompany()); // VAT уже занят

      await expect(
        service.create({ name: 'Other', countryCode: 'DE', vatNumber: 'PL9876543210' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── setGroupChat ─────────────────────────────────────────────────────────────

  describe('setGroupChat', () => {
    it('устанавливает корректный chatId', async () => {
      const company = makeCompany({ telegramGroupChatId: null });
      repo.findOne.mockResolvedValue(company);
      repo.save.mockResolvedValue({ ...company, telegramGroupChatId: '-1001234567890' });

      const result = await service.setGroupChat(1, '-1001234567890');
      expect(result.telegramGroupChatId).toBe('-1001234567890');
    });

    it('выбрасывает BadRequestException при положительном chatId', async () => {
      repo.findOne.mockResolvedValue(makeCompany());
      await expect(service.setGroupChat(1, '123456789')).rejects.toThrow(BadRequestException);
    });

    it('выбрасывает BadRequestException при нечисловом chatId', async () => {
      repo.findOne.mockResolvedValue(makeCompany());
      await expect(service.setGroupChat(1, 'not-a-number')).rejects.toThrow(BadRequestException);
    });
  });

  // ── resolveDeliveryContacts ─────────────────────────────────────────────────

  describe('resolveDeliveryContacts', () => {
    it('возвращает полные контакты для рассылки', async () => {
      const company = makeCompany();
      repo.findOne.mockResolvedValue(company);

      const result = await service.resolveDeliveryContacts(
        1,
        mockContact,
        new Date('2025-03-10T12:00:00Z'),
      );

      expect(result.companyName).toBe('CleanService sp. z o.o.');
      expect(result.contactName).toBe('Klaus Weber');          // из primaryContactName
      expect(result.telegramId).toBe('123456789');              // из user
      expect(result.groupChatId).toBe('-1001234567890');        // из company
      expect(result.email).toBe('invoices@cleanservice.pl');   // из company
      expect(result.vatRate).toBe(23);
      expect(result.invoiceTerms).toBe(InvoiceTerms.NET_30);
      expect(result.dueDateStr).toBe('2025-04-09');             // +30 дней
    });

    it('берёт contactName из user.displayName если primaryContactName не задан', async () => {
      const company = makeCompany({ primaryContactName: null });
      repo.findOne.mockResolvedValue(company);

      const result = await service.resolveDeliveryContacts(1, mockContact, new Date());
      expect(result.contactName).toBe('Klaus Weber'); // из user.displayName
    });

    it('возвращает null groupChatId если не настроен', async () => {
      const company = makeCompany({ telegramGroupChatId: null });
      repo.findOne.mockResolvedValue(company);

      const result = await service.resolveDeliveryContacts(1, mockContact, new Date());
      expect(result.groupChatId).toBeNull();
    });

    it('корректно вычисляет dueDateStr для NET60', async () => {
      const company = makeCompany({ invoiceTerms: InvoiceTerms.NET_60 });
      repo.findOne.mockResolvedValue(company);

      const issued = new Date('2025-01-01');
      const result = await service.resolveDeliveryContacts(1, mockContact, issued);
      expect(result.dueDateStr).toBe('2025-03-02'); // +60 дней
    });
  });

  // ── Company.calcDueDate ──────────────────────────────────────────────────────

  describe('Company.calcDueDateStr', () => {
    it('NET30: +30 дней', () => {
      const c = makeCompany({ invoiceTerms: InvoiceTerms.NET_30 });
      expect(c.calcDueDateStr(new Date('2025-03-10T12:00:00Z'))).toBe('2025-04-09');
    });

    it('NET15: +15 дней', () => {
      const c = makeCompany({ invoiceTerms: InvoiceTerms.NET_15 });
      expect(c.calcDueDateStr(new Date('2025-03-10'))).toBe('2025-03-25');
    });

    it('NET60: +60 дней', () => {
      const c = makeCompany({ invoiceTerms: InvoiceTerms.NET_60 });
      expect(c.calcDueDateStr(new Date('2025-01-01'))).toBe('2025-03-02');
    });
  });
});
