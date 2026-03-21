"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const invoice_entity_1 = require("./entities/invoice.entity");
const invoices_service_1 = require("./invoices.service");
const invoices_controller_1 = require("./invoices.controller");
const invoice_distribution_service_1 = require("./invoice-distribution.service");
const s3_storage_service_1 = require("./channels/s3-storage.service");
const telegram_delivery_service_1 = require("./channels/telegram-delivery.service");
const email_delivery_service_1 = require("./channels/email-delivery.service");
let InvoicesModule = class InvoicesModule {
};
exports.InvoicesModule = InvoicesModule;
exports.InvoicesModule = InvoicesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            typeorm_1.TypeOrmModule.forFeature([invoice_entity_1.Invoice, invoice_entity_1.InvoiceDelivery]),
            platform_express_1.MulterModule.register({ storage: (0, multer_1.memoryStorage)() }),
        ],
        controllers: [invoices_controller_1.InvoicesController],
        providers: [
            invoices_service_1.InvoicesService,
            invoice_distribution_service_1.InvoiceDistributionService,
            s3_storage_service_1.S3StorageService,
            telegram_delivery_service_1.TelegramDeliveryService,
            email_delivery_service_1.EmailDeliveryService,
        ],
        exports: [invoices_service_1.InvoicesService],
    })
], InvoicesModule);
//# sourceMappingURL=invoices.module.js.map