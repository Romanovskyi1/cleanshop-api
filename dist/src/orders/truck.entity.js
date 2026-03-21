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
exports.Truck = void 0;
const typeorm_1 = require("typeorm");
const order_entity_1 = require("./entities/order.entity");
let Truck = class Truck {
    get displayName() {
        return this.licensePlate
            ? `Фура ${this.number} (${this.licensePlate})`
            : `Фура ${this.number}`;
    }
};
exports.Truck = Truck;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Truck.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'order_id' }),
    __metadata("design:type", Number)
], Truck.prototype, "orderId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => order_entity_1.Order, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'order_id' }),
    __metadata("design:type", order_entity_1.Order)
], Truck.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Truck.prototype, "number", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_pallets', default: 33 }),
    __metadata("design:type", Number)
], Truck.prototype, "maxPallets", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'max_weight_kg',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 24000,
    }),
    __metadata("design:type", Number)
], Truck.prototype, "maxWeightKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'license_plate', nullable: true, length: 20 }),
    __metadata("design:type", String)
], Truck.prototype, "licensePlate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'driver_name', nullable: true, length: 255 }),
    __metadata("design:type", String)
], Truck.prototype, "driverName", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Truck.prototype, "createdAt", void 0);
exports.Truck = Truck = __decorate([
    (0, typeorm_1.Entity)('trucks'),
    (0, typeorm_1.Index)(['orderId'])
], Truck);
//# sourceMappingURL=truck.entity.js.map