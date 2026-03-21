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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const invoices_service_1 = require("./invoices.service");
const invoice_dto_1 = require("./dto/invoice.dto");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../users/user.entity");
let InvoicesController = class InvoicesController {
    constructor(service) {
        this.service = service;
    }
    async upload(file, dto, manager) {
        if (!file)
            throw new common_1.BadRequestException('PDF-файл обязателен');
        const contacts = await this.resolveContacts(dto.companyId);
        return this.service.uploadAndDistribute(manager.id, dto, file.buffer, file.originalname, contacts);
    }
    findAll(user, query) {
        if (!user.isManager) {
            return this.service.findByCompany(user.companyId);
        }
        return this.service.findAll(query);
    }
    async findOne(id, user) {
        const invoice = await this.service.findById(id);
        if (!user.isManager && invoice.companyId !== user.companyId) {
            throw new common_1.BadRequestException('Доступ запрещён');
        }
        return invoice;
    }
    getDownloadUrl(id, user) {
        const companyId = user.isManager ? undefined : user.companyId;
        return this.service.getDownloadUrl(id, companyId ?? 0);
    }
    getDeliveryStatus(id) {
        return this.service.getDeliveryStatus(id);
    }
    updateStatus(id, dto, manager) {
        return this.service.updateStatus(id, manager.id, dto);
    }
    async resend(id, dto, manager) {
        const invoice = await this.service.findById(id);
        const contacts = await this.resolveContacts(invoice.companyId);
        return this.service.resend(id, manager.id, dto.channels, contacts);
    }
    async resolveContacts(companyId) {
        return {
            companyName: `Company #${companyId}`,
            contactName: 'Client',
            telegramId: '',
            groupChatId: null,
            email: null,
        };
    }
};
exports.InvoicesController = InvoicesController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (file.mimetype !== 'application/pdf') {
                return cb(new common_1.BadRequestException('Только PDF-файлы'), false);
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, invoice_dto_1.UploadInvoiceDto,
        user_entity_1.User]),
    __metadata("design:returntype", Promise)
], InvoicesController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_1.User,
        invoice_dto_1.InvoiceQueryDto]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User]),
    __metadata("design:returntype", Promise)
], InvoicesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/download-url'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "getDownloadUrl", null);
__decorate([
    (0, common_1.Get)(':id/delivery-status'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "getDeliveryStatus", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, invoice_dto_1.UpdateInvoiceStatusDto,
        user_entity_1.User]),
    __metadata("design:returntype", void 0)
], InvoicesController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)(':id/resend'),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.MANAGER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, invoice_dto_1.ResendInvoiceDto,
        user_entity_1.User]),
    __metadata("design:returntype", Promise)
], InvoicesController.prototype, "resend", null);
exports.InvoicesController = InvoicesController = __decorate([
    (0, common_1.Controller)('invoices'),
    __metadata("design:paramtypes", [invoices_service_1.InvoicesService])
], InvoicesController);
//# sourceMappingURL=invoices.controller.js.map