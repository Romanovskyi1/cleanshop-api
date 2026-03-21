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
exports.OrderStatusHistory = void 0;
const typeorm_1 = require("typeorm");
const order_entity_1 = require("./order.entity");
let OrderStatusHistory = class OrderStatusHistory {
};
exports.OrderStatusHistory = OrderStatusHistory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], OrderStatusHistory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'order_id' }),
    __metadata("design:type", Number)
], OrderStatusHistory.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'from_status',
        type: 'enum',
        enum: order_entity_1.OrderStatus,
        nullable: true,
    }),
    __metadata("design:type", String)
], OrderStatusHistory.prototype, "fromStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'to_status',
        type: 'enum',
        enum: order_entity_1.OrderStatus,
    }),
    __metadata("design:type", String)
], OrderStatusHistory.prototype, "toStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_id', nullable: true }),
    __metadata("design:type", Number)
], OrderStatusHistory.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_role', nullable: true, length: 20 }),
    __metadata("design:type", String)
], OrderStatusHistory.prototype, "actorRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, length: 500 }),
    __metadata("design:type", String)
], OrderStatusHistory.prototype, "comment", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], OrderStatusHistory.prototype, "createdAt", void 0);
exports.OrderStatusHistory = OrderStatusHistory = __decorate([
    (0, typeorm_1.Entity)('order_status_history'),
    (0, typeorm_1.Index)(['orderId', 'createdAt'])
], OrderStatusHistory);
//# sourceMappingURL=order-status-history.entity.js.map