"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PalletsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const pallets_service_1 = require("./pallets.service");
const pallets_controller_1 = require("./pallets.controller");
const pallet_entity_1 = require("./entities/pallet.entity");
const truck_entity_1 = require("../orders/entities/truck.entity");
const order_entity_1 = require("../orders/entities/order.entity");
const product_entity_1 = require("../products/entities/product.entity");
let PalletsModule = class PalletsModule {
};
exports.PalletsModule = PalletsModule;
exports.PalletsModule = PalletsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([pallet_entity_1.Pallet, pallet_entity_1.PalletItem, truck_entity_1.Truck, order_entity_1.Order, product_entity_1.Product]),
        ],
        controllers: [pallets_controller_1.PalletsController],
        providers: [pallets_service_1.PalletsService],
        exports: [pallets_service_1.PalletsService],
    })
], PalletsModule);
//# sourceMappingURL=pallets.module.js.map