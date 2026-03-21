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
exports.Product = exports.ProductCategory = void 0;
const typeorm_1 = require("typeorm");
var ProductCategory;
(function (ProductCategory) {
    ProductCategory["GEL"] = "gel";
    ProductCategory["POWDER"] = "powder";
    ProductCategory["CONCENTRATE"] = "concentrate";
    ProductCategory["TABLET"] = "tablet";
    ProductCategory["SPRAY"] = "spray";
})(ProductCategory || (exports.ProductCategory = ProductCategory = {}));
let Product = class Product {
    get boxPriceEur() {
        return Number((this.priceEur * this.unitsPerBox).toFixed(2));
    }
    get palletPriceEur() {
        return Number((this.priceEur * this.unitsPerBox * this.boxesPerPallet).toFixed(2));
    }
    get computedBoxWeightKg() {
        if (this.boxWeightKg)
            return Number(this.boxWeightKg);
        if (this.weightKg)
            return Number((this.weightKg * this.unitsPerBox).toFixed(3));
        return 15;
    }
    get stockStatus() {
        if (this.stockPallets <= 0)
            return 'out';
        if (this.stockPallets < 10)
            return 'low';
        return 'ok';
    }
    getLocaleName(lang = 'en') {
        return (this.name[lang] ??
            this.name.en ??
            this.name.ru ??
            this.sku);
    }
};
exports.Product = Product;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Product.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ length: 50 }),
    __metadata("design:type", String)
], Product.prototype, "sku", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], Product.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Product.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ProductCategory,
    }),
    __metadata("design:type", String)
], Product.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'volume_l', type: 'decimal', precision: 10, scale: 3, nullable: true }),
    __metadata("design:type", Number)
], Product.prototype, "volumeL", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'weight_kg', type: 'decimal', precision: 10, scale: 3, nullable: true }),
    __metadata("design:type", Number)
], Product.prototype, "weightKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'price_eur', type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], Product.prototype, "priceEur", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'units_per_box', default: 1 }),
    __metadata("design:type", Number)
], Product.prototype, "unitsPerBox", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'boxes_per_pallet', default: 40 }),
    __metadata("design:type", Number)
], Product.prototype, "boxesPerPallet", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pallets_per_truck', default: 33 }),
    __metadata("design:type", Number)
], Product.prototype, "palletsPerTruck", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pallet_weight_kg', type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Product.prototype, "palletWeightKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'box_weight_kg', type: 'decimal', precision: 10, scale: 3, nullable: true }),
    __metadata("design:type", Number)
], Product.prototype, "boxWeightKg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'stock_pallets', default: 0 }),
    __metadata("design:type", Number)
], Product.prototype, "stockPallets", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_eco', default: false }),
    __metadata("design:type", Boolean)
], Product.prototype, "isEco", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], Product.prototype, "certifications", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', array: true, default: '{}' }),
    __metadata("design:type", Array)
], Product.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', default: true }),
    __metadata("design:type", Boolean)
], Product.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_new', default: false }),
    __metadata("design:type", Boolean)
], Product.prototype, "isNew", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_hit', default: false }),
    __metadata("design:type", Boolean)
], Product.prototype, "isHit", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Product.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Product.prototype, "updatedAt", void 0);
exports.Product = Product = __decorate([
    (0, typeorm_1.Entity)('products')
], Product);
//# sourceMappingURL=product.entity.js.map