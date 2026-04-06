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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceDelivery = exports.Invoice = exports.DeliveryStatus = exports.DeliveryChannel = exports.InvoiceStatus = void 0;
const typeorm_1 = require("typeorm");
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["PENDING"] = "pending";
    InvoiceStatus["PAID"] = "paid";
    InvoiceStatus["OVERDUE"] = "overdue";
    InvoiceStatus["CANCELLED"] = "cancelled";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var DeliveryChannel;
(function (DeliveryChannel) {
    DeliveryChannel["TELEGRAM_PERSONAL"] = "telegram_personal";
    DeliveryChannel["TELEGRAM_GROUP"] = "telegram_group";
    DeliveryChannel["EMAIL"] = "email";
})(DeliveryChannel || (exports.DeliveryChannel = DeliveryChannel = {}));
var DeliveryStatus;
(function (DeliveryStatus) {
    DeliveryStatus["SENT"] = "sent";
    DeliveryStatus["FAILED"] = "failed";
    DeliveryStatus["RESENT"] = "resent";
})(DeliveryStatus || (exports.DeliveryStatus = DeliveryStatus = {}));
let Invoice = class Invoice {
    get isOverdue() {
        return this.status === InvoiceStatus.PENDING && new Date(this.dueDate) < new Date();
    }
};
exports.Invoice = Invoice;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Invoice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ name: 'invoice_number', length: 50 }),
    __metadata("design:type", String)
], Invoice.prototype, "invoiceNumber", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'company_id' }),
    __metadata("design:type", Number)
], Invoice.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_id', nullable: true }),
    __metadata("design:type", Number)
], Invoice.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'issued_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Invoice.prototype, "issuedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'due_date', type: 'date' }),
    __metadata("design:type", String)
], Invoice.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subtotal_eur', type: 'decimal', precision: 14, scale: 2 }),
    __metadata("design:type", Number)
], Invoice.prototype, "subtotalEur", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vat_rate', type: 'decimal', precision: 5, scale: 2 }),
    __metadata("design:type", Number)
], Invoice.prototype, "vatRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vat_amount', type: 'decimal', precision: 14, scale: 2 }),
    __metadata("design:type", Number)
], Invoice.prototype, "vatAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_eur', type: 'decimal', precision: 14, scale: 2 }),
    __metadata("design:type", Number)
], Invoice.prototype, "totalEur", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING }),
    __metadata("design:type", String)
], Invoice.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pdf_url', nullable: true }),
    __metadata("design:type", String)
], Invoice.prototype, "pdfUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'paid_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], Invoice.prototype, "paidAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => InvoiceDelivery, d => d.invoice, { cascade: true }),
    __metadata("design:type", Array)
], Invoice.prototype, "deliveries", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Invoice.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Invoice.prototype, "updatedAt", void 0);
exports.Invoice = Invoice = __decorate([
    (0, typeorm_1.Entity)('invoices'),
    (0, typeorm_1.Index)(['companyId', 'status'])
], Invoice);
let InvoiceDelivery = class InvoiceDelivery {
};
exports.InvoiceDelivery = InvoiceDelivery;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InvoiceDelivery.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_id' }),
    __metadata("design:type", Number)
], InvoiceDelivery.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: DeliveryChannel }),
    __metadata("design:type", String)
], InvoiceDelivery.prototype, "channel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.SENT }),
    __metadata("design:type", String)
], InvoiceDelivery.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recipient', nullable: true }),
    __metadata("design:type", String)
], InvoiceDelivery.prototype, "recipient", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error', type: 'text', nullable: true }),
    __metadata("design:type", String)
], InvoiceDelivery.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], InvoiceDelivery.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InvoiceDelivery.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], InvoiceDelivery.prototype, "updatedAt", void 0);
exports.InvoiceDelivery = InvoiceDelivery = __decorate([
    (0, typeorm_1.Entity)('invoice_deliveries'),
    (0, typeorm_1.Index)(['invoiceId', 'channel'])
], InvoiceDelivery);
//# sourceMappingURL=invoice.entity.js.map