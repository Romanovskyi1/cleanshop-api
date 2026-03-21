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
exports.Company = exports.InvoiceTerms = void 0;
const typeorm_1 = require("typeorm");
var InvoiceTerms;
(function (InvoiceTerms) {
    InvoiceTerms["NET_15"] = "NET15";
    InvoiceTerms["NET_30"] = "NET30";
    InvoiceTerms["NET_60"] = "NET60";
})(InvoiceTerms || (exports.InvoiceTerms = InvoiceTerms = {}));
let Company = class Company {
    get paymentDays() {
        return parseInt(this.invoiceTerms.replace('NET', ''), 10);
    }
    calcDueDate(issuedAt) {
        const due = new Date(issuedAt);
        due.setDate(due.getDate() + this.paymentDays);
        return due;
    }
    calcDueDateStr(issuedAt) {
        return this.calcDueDate(issuedAt).toISOString().slice(0, 10);
    }
};
exports.Company = Company;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Company.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 500 }),
    __metadata("design:type", String)
], Company.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vat_number', nullable: true, length: 50 }),
    __metadata("design:type", String)
], Company.prototype, "vatNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Company.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'country_code', length: 2, default: 'DE' }),
    __metadata("design:type", String)
], Company.prototype, "countryCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_email', nullable: true, length: 255 }),
    __metadata("design:type", String)
], Company.prototype, "invoiceEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'telegram_group_chat_id', nullable: true, length: 30 }),
    __metadata("design:type", String)
], Company.prototype, "telegramGroupChatId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'primary_contact_name', nullable: true, length: 255 }),
    __metadata("design:type", String)
], Company.prototype, "primaryContactName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'invoice_terms',
        type: 'enum',
        enum: InvoiceTerms,
        default: InvoiceTerms.NET_30,
    }),
    __metadata("design:type", String)
], Company.prototype, "invoiceTerms", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'vat_rate',
        type: 'decimal',
        precision: 5,
        scale: 2,
        default: 23.00,
    }),
    __metadata("design:type", Number)
], Company.prototype, "vatRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, length: 34 }),
    __metadata("design:type", String)
], Company.prototype, "iban", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', default: true }),
    __metadata("design:type", Boolean)
], Company.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Company.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Company.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Company.prototype, "updatedAt", void 0);
exports.Company = Company = __decorate([
    (0, typeorm_1.Entity)('companies')
], Company);
//# sourceMappingURL=company.entity.js.map