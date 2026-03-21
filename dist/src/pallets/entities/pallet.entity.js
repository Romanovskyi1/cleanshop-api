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
exports.PalletItem = exports.Pallet = exports.PalletStatus = void 0;
const typeorm_1 = require("typeorm");
var PalletStatus;
(function (PalletStatus) {
    PalletStatus["BUILDING"] = "building";
    PalletStatus["READY"] = "ready";
    PalletStatus["ASSIGNED"] = "assigned";
    PalletStatus["LOCKED"] = "locked";
})(PalletStatus || (exports.PalletStatus = PalletStatus = {}));
let Pallet = class Pallet {
    get isEditable() {
        return this.status === PalletStatus.BUILDING || this.status === PalletStatus.READY;
    }
    get fillPercent() {
        const maxBoxes = 40;
        return Math.round((this.totalBoxes / maxBoxes) * 100);
    }
};
exports.Pallet = Pallet;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Pallet.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'company_id' }),
    __metadata("design:type", Number)
], Pallet.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'order_id', nullable: true }),
    __metadata("design:type", Number)
], Pallet.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'truck_id', nullable: true }),
    __metadata("design:type", Number)
], Pallet.prototype, "truckId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, length: 100 }),
    __metadata("design:type", String)
], Pallet.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_boxes', default: 0 }),
    __metadata("design:type", Number)
], Pallet.prototype, "totalBoxes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_weight_kg', type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pallet.prototype, "totalWeightKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_amount_eur', type: 'decimal', precision: 14, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pallet.prototype, "totalAmountEur", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: PalletStatus, default: PalletStatus.BUILDING }),
    __metadata("design:type", String)
], Pallet.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PalletItem, item => item.pallet, { cascade: true, eager: true }),
    __metadata("design:type", Array)
], Pallet.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Pallet.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Pallet.prototype, "updatedAt", void 0);
exports.Pallet = Pallet = __decorate([
    (0, typeorm_1.Entity)('pallets'),
    (0, typeorm_1.Index)(['companyId', 'orderId'])
], Pallet);
let PalletItem = class PalletItem {
};
exports.PalletItem = PalletItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], PalletItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pallet_id' }),
    __metadata("design:type", Number)
], PalletItem.prototype, "palletId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Pallet, pallet => pallet.items, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'pallet_id' }),
    __metadata("design:type", Pallet)
], PalletItem.prototype, "pallet", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'product_id' }),
    __metadata("design:type", Number)
], PalletItem.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'price_eur', type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], PalletItem.prototype, "priceEur", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'boxes' }),
    __metadata("design:type", Number)
], PalletItem.prototype, "boxes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subtotal_eur', type: 'decimal', precision: 14, scale: 2 }),
    __metadata("design:type", Number)
], PalletItem.prototype, "subtotalEur", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PalletItem.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], PalletItem.prototype, "updatedAt", void 0);
exports.PalletItem = PalletItem = __decorate([
    (0, typeorm_1.Entity)('pallet_items'),
    (0, typeorm_1.Index)(['palletId', 'productId'], { unique: true })
], PalletItem);
//# sourceMappingURL=pallet.entity.js.map