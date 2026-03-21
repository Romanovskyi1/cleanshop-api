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
exports.Order = exports.ALLOWED_TRANSITIONS = exports.OrderStatus = void 0;
const typeorm_1 = require("typeorm");
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["DRAFT"] = "draft";
    OrderStatus["NEGOTIATING"] = "negotiating";
    OrderStatus["CONFIRMED"] = "confirmed";
    OrderStatus["BUILDING"] = "building";
    OrderStatus["LOCKED"] = "locked";
    OrderStatus["SHIPPED"] = "shipped";
    OrderStatus["CANCELLED"] = "cancelled";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
exports.ALLOWED_TRANSITIONS = {
    [OrderStatus.DRAFT]: [OrderStatus.NEGOTIATING, OrderStatus.CANCELLED],
    [OrderStatus.NEGOTIATING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.BUILDING, OrderStatus.CANCELLED],
    [OrderStatus.BUILDING]: [OrderStatus.LOCKED, OrderStatus.CANCELLED],
    [OrderStatus.LOCKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [],
    [OrderStatus.CANCELLED]: [],
};
let Order = class Order {
    get isPalletWindowOpen() {
        if (!this.windowOpensAt || !this.windowClosesAt)
            return false;
        const now = new Date();
        return now >= this.windowOpensAt && now <= this.windowClosesAt;
    }
    get isEditable() {
        return ![OrderStatus.SHIPPED, OrderStatus.CANCELLED].includes(this.status);
    }
    canTransitionTo(next) {
        return exports.ALLOWED_TRANSITIONS[this.status]?.includes(next) ?? false;
    }
};
exports.Order = Order;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Order.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'company_id' }),
    __metadata("design:type", Number)
], Order.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'proposed_date', type: 'date', nullable: true }),
    __metadata("design:type", String)
], Order.prototype, "proposedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confirmed_date', type: 'date', nullable: true }),
    __metadata("design:type", String)
], Order.prototype, "confirmedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: OrderStatus,
        default: OrderStatus.DRAFT,
    }),
    __metadata("design:type", String)
], Order.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'proposed_by', nullable: true }),
    __metadata("design:type", Number)
], Order.prototype, "proposedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confirmed_by', nullable: true }),
    __metadata("design:type", Number)
], Order.prototype, "confirmedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'locked_by', nullable: true }),
    __metadata("design:type", Number)
], Order.prototype, "lockedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shipped_by', nullable: true }),
    __metadata("design:type", Number)
], Order.prototype, "shippedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_pallets', default: 0 }),
    __metadata("design:type", Number)
], Order.prototype, "totalPallets", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'total_weight_kg',
        type: 'decimal',
        precision: 12,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Order.prototype, "totalWeightKg", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'total_amount_eur',
        type: 'decimal',
        precision: 14,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Order.prototype, "totalAmountEur", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'truck_count', default: 1 }),
    __metadata("design:type", Number)
], Order.prototype, "truckCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, length: 1000 }),
    __metadata("design:type", String)
], Order.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'window_opens_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Date)
], Order.prototype, "windowOpensAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'window_closes_at',
        type: 'timestamptz',
        nullable: true,
    }),
    __metadata("design:type", Date)
], Order.prototype, "windowClosesAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'shipped_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], Order.prototype, "shippedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Order.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Order.prototype, "updatedAt", void 0);
exports.Order = Order = __decorate([
    (0, typeorm_1.Entity)('orders'),
    (0, typeorm_1.Index)(['companyId', 'status']),
    (0, typeorm_1.Index)(['confirmedDate'])
], Order);
//# sourceMappingURL=order.entity.js.map