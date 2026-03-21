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
exports.PalletsController = void 0;
const common_1 = require("@nestjs/common");
const pallets_service_1 = require("./pallets.service");
const pallet_dto_1 = require("./dto/pallet.dto");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const user_entity_1 = require("../users/user.entity");
let PalletsController = class PalletsController {
    constructor(service) {
        this.service = service;
    }
    findAll(user, query) {
        return this.service.findAll(user.companyId, query);
    }
    findOne(id, user) {
        return this.service.findOne(id, user.companyId);
    }
    create(user, dto) {
        return this.service.create(user.companyId, dto);
    }
    update(id, user, dto) {
        return this.service.update(id, user.companyId, dto);
    }
    remove(id, user) {
        return this.service.remove(id, user.companyId);
    }
    addItem(palletId, user, dto) {
        const productData = {
            priceEur: 12.40,
            unitsPerBox: 24,
            weightPerBoxKg: 15,
        };
        return this.service.addItem(palletId, user.companyId, dto, productData);
    }
    updateItem(palletId, itemId, user, dto) {
        const productData = {
            priceEur: 12.40,
            unitsPerBox: 24,
            weightPerBoxKg: 15,
        };
        return this.service.updateItem(palletId, itemId, user.companyId, dto, productData);
    }
    removeItem(palletId, itemId, user) {
        return this.service.removeItem(palletId, itemId, user.companyId);
    }
    trucksSummary(orderId, user) {
        return this.service.getTrucksSummary(orderId, user.companyId);
    }
    unassigned(orderId, user) {
        return this.service.getUnassigned(orderId, user.companyId);
    }
    assignToTruck(orderId, truckId, user, dto) {
        return this.service.assignPalletsToTruck(truckId, orderId, user.companyId, dto);
    }
    removeFromTruck(palletId, user) {
        return this.service.removePalletFromTruck(palletId, user.companyId);
    }
};
exports.PalletsController = PalletsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_1.User,
        pallet_dto_1.PalletQueryDto]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_entity_1.User,
        pallet_dto_1.CreatePalletDto]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User,
        pallet_dto_1.UpdatePalletDto]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/items'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User,
        pallet_dto_1.AddPalletItemDto]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "addItem", null);
__decorate([
    (0, common_1.Patch)(':id/items/:itemId'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('itemId', common_1.ParseIntPipe)),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, user_entity_1.User,
        pallet_dto_1.UpdatePalletItemDto]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "updateItem", null);
__decorate([
    (0, common_1.Delete)(':id/items/:itemId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('itemId', common_1.ParseIntPipe)),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, user_entity_1.User]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "removeItem", null);
__decorate([
    (0, common_1.Get)('trucks/:orderId/summary'),
    __param(0, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "trucksSummary", null);
__decorate([
    (0, common_1.Get)('trucks/:orderId/unassigned'),
    __param(0, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "unassigned", null);
__decorate([
    (0, common_1.Patch)('trucks/:orderId/:truckId'),
    __param(0, (0, common_1.Param)('orderId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('truckId', common_1.ParseIntPipe)),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, user_entity_1.User,
        pallet_dto_1.AssignPalletsToTruckDto]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "assignToTruck", null);
__decorate([
    (0, common_1.Delete)(':id/truck'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, user_entity_1.User]),
    __metadata("design:returntype", void 0)
], PalletsController.prototype, "removeFromTruck", null);
exports.PalletsController = PalletsController = __decorate([
    (0, common_1.Controller)('pallets'),
    __metadata("design:paramtypes", [pallets_service_1.PalletsService])
], PalletsController);
//# sourceMappingURL=pallets.controller.js.map