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
exports.PalletQueryDto = exports.AssignPalletsToTruckDto = exports.UpdatePalletItemDto = exports.AddPalletItemDto = exports.UpdatePalletDto = exports.CreatePalletDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const pallet_entity_1 = require("../entities/pallet.entity");
class CreatePalletDto {
}
exports.CreatePalletDto = CreatePalletDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePalletDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreatePalletDto.prototype, "orderId", void 0);
class UpdatePalletDto {
}
exports.UpdatePalletDto = UpdatePalletDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdatePalletDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], UpdatePalletDto.prototype, "truckId", void 0);
class AddPalletItemDto {
}
exports.AddPalletItemDto = AddPalletItemDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], AddPalletItemDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10_000),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], AddPalletItemDto.prototype, "boxes", void 0);
class UpdatePalletItemDto {
}
exports.UpdatePalletItemDto = UpdatePalletItemDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10_000),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], UpdatePalletItemDto.prototype, "boxes", void 0);
class AssignPalletsToTruckDto {
}
exports.AssignPalletsToTruckDto = AssignPalletsToTruckDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.IsPositive)({ each: true }),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Array)
], AssignPalletsToTruckDto.prototype, "palletIds", void 0);
class PalletQueryDto {
}
exports.PalletQueryDto = PalletQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], PalletQueryDto.prototype, "orderId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(Object.values(pallet_entity_1.PalletStatus)),
    __metadata("design:type", String)
], PalletQueryDto.prototype, "status", void 0);
//# sourceMappingURL=pallet.dto.js.map