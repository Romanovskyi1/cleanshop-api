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
var CompaniesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const company_entity_1 = require("./entities/company.entity");
let CompaniesService = CompaniesService_1 = class CompaniesService {
    constructor(repo) {
        this.repo = repo;
        this.logger = new common_1.Logger(CompaniesService_1.name);
    }
    async findAll() {
        return this.repo.find({
            order: { name: 'ASC' },
        });
    }
    async findById(id) {
        const company = await this.repo.findOne({ where: { id } });
        if (!company)
            throw new common_1.NotFoundException(`Компания #${id} не найдена`);
        return company;
    }
    async create(dto) {
        if (dto.vatNumber) {
            const existing = await this.repo.findOne({ where: { vatNumber: dto.vatNumber } });
            if (existing) {
                throw new common_1.ConflictException(`Компания с VAT ${dto.vatNumber} уже существует (id=${existing.id})`);
            }
        }
        const company = this.repo.create(dto);
        const saved = await this.repo.save(company);
        this.logger.log(`Company created: id=${saved.id} name="${saved.name}"`);
        return saved;
    }
    async update(id, dto) {
        const company = await this.findById(id);
        Object.assign(company, dto);
        const saved = await this.repo.save(company);
        this.logger.log(`Company updated: id=${id}`);
        return saved;
    }
    async setGroupChat(id, chatId) {
        this.validateGroupChatId(chatId);
        const company = await this.findById(id);
        company.telegramGroupChatId = chatId;
        const saved = await this.repo.save(company);
        this.logger.log(`Company #${id}: groupChatId set to ${chatId}`);
        return saved;
    }
    async deactivate(id) {
        const company = await this.findById(id);
        company.isActive = false;
        return this.repo.save(company);
    }
    async resolveDeliveryContacts(companyId, contact, issuedAt) {
        const company = await this.findById(companyId);
        const contactName = company.primaryContactName
            ?? contact.displayName
            ?? `${contact.firstName} ${contact.lastName ?? ''}`.trim();
        return {
            companyName: company.name,
            contactName,
            telegramId: contact.telegramId,
            groupChatId: company.telegramGroupChatId,
            email: company.invoiceEmail,
            vatRate: Number(company.vatRate),
            invoiceTerms: company.invoiceTerms,
            dueDateStr: company.calcDueDateStr(issuedAt),
        };
    }
    async getVatRate(companyId) {
        const company = await this.findById(companyId);
        return Number(company.vatRate);
    }
    async getInvoiceTerms(companyId) {
        const company = await this.findById(companyId);
        return company.invoiceTerms;
    }
    validateGroupChatId(chatId) {
        const n = Number(chatId);
        if (isNaN(n) || n >= 0) {
            throw new common_1.BadRequestException(`Некорректный Telegram group chat ID: "${chatId}". ` +
                'Должен быть отрицательным числом, например: -1001234567890');
        }
    }
};
exports.CompaniesService = CompaniesService;
exports.CompaniesService = CompaniesService = CompaniesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(company_entity_1.Company)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], CompaniesService);
//# sourceMappingURL=companies.service.js.map