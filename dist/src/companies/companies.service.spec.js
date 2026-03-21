"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const companies_service_1 = require("./companies.service");
const company_entity_1 = require("./entities/company.entity");
function makeCompany(overrides = {}) {
    return Object.assign(new company_entity_1.Company(), {
        id: 1,
        name: 'CleanService sp. z o.o.',
        vatNumber: 'PL9876543210',
        address: 'ul. Marszałkowska 84, Warszawa',
        countryCode: 'PL',
        invoiceEmail: 'invoices@cleanservice.pl',
        telegramGroupChatId: '-1001234567890',
        primaryContactName: 'Klaus Weber',
        invoiceTerms: company_entity_1.InvoiceTerms.NET_30,
        vatRate: 23.00,
        iban: null,
        notes: null,
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        get paymentDays() { return parseInt(this.invoiceTerms.replace('NET', ''), 10); },
        calcDueDate(issued) {
            const d = new Date(issued);
            d.setDate(d.getDate() + this.paymentDays);
            return d;
        },
        calcDueDateStr(issued) {
            return this.calcDueDate(issued).toISOString().slice(0, 10);
        },
        ...overrides,
    });
}
const mockContact = {
    id: 1, telegramId: '123456789',
    firstName: 'Klaus', lastName: 'Weber',
    displayName: 'Klaus Weber', companyId: 1,
};
describe('CompaniesService', () => {
    let service;
    let repo;
    beforeEach(async () => {
        repo = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest.fn().mockImplementation(d => ({ ...d })),
            save: jest.fn().mockImplementation(e => Promise.resolve(e)),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                companies_service_1.CompaniesService,
                { provide: (0, typeorm_1.getRepositoryToken)(company_entity_1.Company), useValue: repo },
            ],
        }).compile();
        service = module.get(companies_service_1.CompaniesService);
    });
    afterEach(() => jest.clearAllMocks());
    describe('findById', () => {
        it('возвращает компанию если найдена', async () => {
            repo.findOne.mockResolvedValue(makeCompany());
            const result = await service.findById(1);
            expect(result.id).toBe(1);
            expect(result.name).toBe('CleanService sp. z o.o.');
        });
        it('выбрасывает NotFoundException', async () => {
            repo.findOne.mockResolvedValue(null);
            await expect(service.findById(999)).rejects.toThrow(common_1.NotFoundException);
        });
    });
    describe('create', () => {
        it('создаёт компанию без VAT', async () => {
            const dto = { name: 'Test GmbH', countryCode: 'DE' };
            const company = makeCompany({ name: 'Test GmbH' });
            repo.findOne.mockResolvedValue(null);
            repo.create.mockReturnValue(company);
            repo.save.mockResolvedValue(company);
            const result = await service.create(dto);
            expect(result.name).toBe('Test GmbH');
        });
        it('выбрасывает ConflictException при дублировании VAT', async () => {
            repo.findOne.mockResolvedValue(makeCompany());
            await expect(service.create({ name: 'Other', countryCode: 'DE', vatNumber: 'PL9876543210' })).rejects.toThrow(common_1.ConflictException);
        });
    });
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
            await expect(service.setGroupChat(1, '123456789')).rejects.toThrow(common_1.BadRequestException);
        });
        it('выбрасывает BadRequestException при нечисловом chatId', async () => {
            repo.findOne.mockResolvedValue(makeCompany());
            await expect(service.setGroupChat(1, 'not-a-number')).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('resolveDeliveryContacts', () => {
        it('возвращает полные контакты для рассылки', async () => {
            const company = makeCompany();
            repo.findOne.mockResolvedValue(company);
            const result = await service.resolveDeliveryContacts(1, mockContact, new Date('2025-03-10'));
            expect(result.companyName).toBe('CleanService sp. z o.o.');
            expect(result.contactName).toBe('Klaus Weber');
            expect(result.telegramId).toBe('123456789');
            expect(result.groupChatId).toBe('-1001234567890');
            expect(result.email).toBe('invoices@cleanservice.pl');
            expect(result.vatRate).toBe(23);
            expect(result.invoiceTerms).toBe(company_entity_1.InvoiceTerms.NET_30);
            expect(result.dueDateStr).toBe('2025-04-09');
        });
        it('берёт contactName из user.displayName если primaryContactName не задан', async () => {
            const company = makeCompany({ primaryContactName: null });
            repo.findOne.mockResolvedValue(company);
            const result = await service.resolveDeliveryContacts(1, mockContact, new Date());
            expect(result.contactName).toBe('Klaus Weber');
        });
        it('возвращает null groupChatId если не настроен', async () => {
            const company = makeCompany({ telegramGroupChatId: null });
            repo.findOne.mockResolvedValue(company);
            const result = await service.resolveDeliveryContacts(1, mockContact, new Date());
            expect(result.groupChatId).toBeNull();
        });
        it('корректно вычисляет dueDateStr для NET60', async () => {
            const company = makeCompany({ invoiceTerms: company_entity_1.InvoiceTerms.NET_60 });
            repo.findOne.mockResolvedValue(company);
            const issued = new Date('2025-01-01');
            const result = await service.resolveDeliveryContacts(1, mockContact, issued);
            expect(result.dueDateStr).toBe('2025-03-02');
        });
    });
    describe('Company.calcDueDateStr', () => {
        it('NET30: +30 дней', () => {
            const c = makeCompany({ invoiceTerms: company_entity_1.InvoiceTerms.NET_30 });
            expect(c.calcDueDateStr(new Date('2025-03-10'))).toBe('2025-04-09');
        });
        it('NET15: +15 дней', () => {
            const c = makeCompany({ invoiceTerms: company_entity_1.InvoiceTerms.NET_15 });
            expect(c.calcDueDateStr(new Date('2025-03-10'))).toBe('2025-03-25');
        });
        it('NET60: +60 дней', () => {
            const c = makeCompany({ invoiceTerms: company_entity_1.InvoiceTerms.NET_60 });
            expect(c.calcDueDateStr(new Date('2025-01-01'))).toBe('2025-03-02');
        });
    });
});
//# sourceMappingURL=companies.service.spec.js.map