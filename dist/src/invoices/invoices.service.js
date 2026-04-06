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
var InvoicesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const invoice_entity_1 = require("./entities/invoice.entity");
const invoice_distribution_service_1 = require("./invoice-distribution.service");
const s3_storage_service_1 = require("./channels/s3-storage.service");
let InvoicesService = InvoicesService_1 = class InvoicesService {
    constructor(invoices, distribution, s3) {
        this.invoices = invoices;
        this.distribution = distribution;
        this.s3 = s3;
        this.logger = new common_1.Logger(InvoicesService_1.name);
    }
    async uploadAndDistribute(managerId, dto, pdfBuffer, filename, contacts) {
        const existing = await this.invoices.findOne({
            where: { invoiceNumber: dto.invoiceNumber },
        });
        if (existing) {
            throw new common_1.ConflictException(`Инвойс ${dto.invoiceNumber} уже существует (id=${existing.id})`);
        }
        const invoice = await this.invoices.save(this.invoices.create({
            invoiceNumber: dto.invoiceNumber,
            orderId: dto.orderId ?? null,
            companyId: dto.companyId,
            issuedAt: new Date(),
            dueDate: dto.dueDate,
            subtotalEur: dto.subtotalEur,
            vatRate: dto.vatRate,
            vatAmount: dto.vatAmount ?? (dto.subtotalEur * dto.vatRate / 100),
            totalEur: dto.totalEur ?? (dto.subtotalEur * (1 + dto.vatRate / 100)),
            status: invoice_entity_1.InvoiceStatus.PENDING,
        }));
        this.logger.log(`Invoice #${invoice.id} (${invoice.invoiceNumber}) created by manager ${managerId}`);
        const channels = this.resolveChannels(dto.channels, contacts);
        const result = await this.distribution.distribute(invoice, pdfBuffer, contacts, channels);
        await this.invoices.update(invoice.id, { pdfUrl: result.pdfUrl });
        invoice.pdfUrl = result.pdfUrl;
        return { invoice, distribution: result };
    }
    async resend(invoiceId, managerId, channels, contacts) {
        const invoice = await this.findById(invoiceId);
        const pdfBuffer = await this.s3.downloadPdf(invoice.invoiceNumber);
        const targetChannels = this.resolveChannels(channels, contacts);
        return this.distribution.resend(invoice, pdfBuffer, contacts, targetChannels);
    }
    async findAll(query) {
        const where = {};
        if (query.status)
            where.status = query.status;
        if (query.companyId)
            where.companyId = query.companyId;
        if (query.orderId)
            where.orderId = query.orderId;
        return this.invoices.find({
            where,
            order: { createdAt: 'DESC' },
        });
    }
    async findById(id) {
        const inv = await this.invoices.findOne({ where: { id } });
        if (!inv)
            throw new common_1.NotFoundException(`Инвойс #${id} не найден`);
        return inv;
    }
    async findByCompany(companyId) {
        return this.invoices.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
        });
    }
    async updateStatus(id, managerId, dto) {
        const invoice = await this.findById(id);
        const update = { status: dto.status };
        if (dto.status === invoice_entity_1.InvoiceStatus.PAID && !invoice.paidAt) {
            update.paidAt = new Date();
        }
        await this.invoices.update(id, update);
        Object.assign(invoice, update);
        this.logger.log(`Invoice #${id} status → ${dto.status} by manager ${managerId}`);
        return invoice;
    }
    async getDeliveryStatus(invoiceId) {
        await this.findById(invoiceId);
        return this.distribution.getDeliveryStatus(invoiceId);
    }
    async getDownloadUrl(invoiceId, companyId) {
        const invoice = await this.findById(invoiceId);
        if (invoice.companyId !== companyId) {
            throw new common_1.ForbiddenException('Доступ к инвойсу запрещён');
        }
        return this.s3.getPresignedUrl(invoice.invoiceNumber);
    }
    resolveChannels(requested, contacts) {
        const all = [
            invoice_entity_1.DeliveryChannel.TELEGRAM_PERSONAL,
            invoice_entity_1.DeliveryChannel.TELEGRAM_GROUP,
            invoice_entity_1.DeliveryChannel.EMAIL,
        ];
        if (!requested || !requested.length) {
            return all.filter(ch => {
                if (ch === invoice_entity_1.DeliveryChannel.TELEGRAM_PERSONAL)
                    return !!contacts.telegramId;
                if (ch === invoice_entity_1.DeliveryChannel.TELEGRAM_GROUP)
                    return !!contacts.groupChatId;
                if (ch === invoice_entity_1.DeliveryChannel.EMAIL)
                    return !!contacts.email;
                return false;
            });
        }
        return requested
            .filter(c => Object.values(invoice_entity_1.DeliveryChannel).includes(c))
            .map(c => c);
    }
};
exports.InvoicesService = InvoicesService;
exports.InvoicesService = InvoicesService = InvoicesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        invoice_distribution_service_1.InvoiceDistributionService,
        s3_storage_service_1.S3StorageService])
], InvoicesService);
//# sourceMappingURL=invoices.service.js.map