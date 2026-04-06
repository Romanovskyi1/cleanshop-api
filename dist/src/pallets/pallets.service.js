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
var PalletsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PalletsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const pallet_entity_1 = require("./entities/pallet.entity");
const truck_entity_1 = require("../orders/entities/truck.entity");
const order_entity_1 = require("../orders/entities/order.entity");
const PALLET_MAX_BOXES = 300;
const PALLET_MAX_WEIGHT_KG = 1000;
const TRUCK_LIMITS = {
    [order_entity_1.TruckType.SMALL_5T]: { maxPallets: 12, maxWeightKg: 5_000 },
    [order_entity_1.TruckType.LARGE_24T]: { maxPallets: 33, maxWeightKg: 24_000 },
};
const DEFAULT_BOX_WEIGHT_KG = 15;
const DEFAULT_BOX_UNIT = 1;
let PalletsService = PalletsService_1 = class PalletsService {
    constructor(pallets, items, trucks, orders, ds) {
        this.pallets = pallets;
        this.items = items;
        this.trucks = trucks;
        this.orders = orders;
        this.ds = ds;
        this.logger = new common_1.Logger(PalletsService_1.name);
    }
    async findAll(companyId, query) {
        const qb = this.pallets
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.items', 'items')
            .where('p.company_id = :companyId', { companyId })
            .orderBy('p.created_at', 'ASC');
        if (query.orderId) {
            qb.andWhere('p.order_id = :orderId', { orderId: query.orderId });
        }
        if (query.status) {
            qb.andWhere('p.status = :status', { status: query.status });
        }
        return qb.getMany();
    }
    async findOne(id, companyId) {
        const pallet = await this.pallets.findOne({
            where: { id, companyId },
            relations: ['items'],
        });
        if (!pallet)
            throw new common_1.NotFoundException(`Паллета #${id} не найдена`);
        return pallet;
    }
    async create(companyId, dto) {
        const pallet = this.pallets.create({
            companyId,
            orderId: dto.orderId ?? null,
            name: dto.name ?? '',
            status: pallet_entity_1.PalletStatus.BUILDING,
        });
        return this.pallets.save(pallet);
    }
    async update(id, companyId, dto) {
        const pallet = await this.findOne(id, companyId);
        this.assertEditable(pallet);
        if (dto.name !== undefined)
            pallet.name = dto.name ?? '';
        if (dto.truckId !== undefined) {
            await this.assignToTruck(pallet, dto.truckId);
        }
        return this.pallets.save(pallet);
    }
    async remove(id, companyId) {
        const pallet = await this.findOne(id, companyId);
        this.assertEditable(pallet);
        await this.pallets.remove(pallet);
        this.logger.log(`Удалена паллета #${id} компании ${companyId}`);
    }
    async addItem(palletId, companyId, dto, productData) {
        return this.ds.transaction(async (em) => {
            const specifiedPallet = await em.findOne(pallet_entity_1.Pallet, {
                where: { id: palletId, companyId },
                relations: ['items'],
            });
            if (!specifiedPallet)
                throw new common_1.NotFoundException(`Паллета #${palletId} не найдена`);
            this.assertEditable(specifiedPallet);
            let pallet = specifiedPallet;
            if (specifiedPallet.orderId) {
                const orderPallets = await em.find(pallet_entity_1.Pallet, {
                    where: { orderId: specifiedPallet.orderId, companyId },
                    relations: ['items'],
                });
                const palletWithProduct = orderPallets.find(p => p.id !== specifiedPallet.id &&
                    p.isEditable &&
                    p.items.some(i => i.productId === dto.productId));
                if (palletWithProduct) {
                    pallet = palletWithProduct;
                }
            }
            if (dto.boxes % productData.unitsPerBox !== 0) {
                throw new common_1.BadRequestException(`Количество коробок должно быть кратно ${productData.unitsPerBox}`);
            }
            const currentBoxes = pallet.items.reduce((s, i) => s + i.boxes, 0);
            const existingItem = pallet.items.find(i => i.productId === dto.productId);
            const existingBoxes = existingItem?.boxes ?? 0;
            const newTotalBoxes = currentBoxes - existingBoxes + dto.boxes;
            if (newTotalBoxes > PALLET_MAX_BOXES) {
                throw new common_1.BadRequestException(`Паллета переполнена: ${newTotalBoxes} кор. > максимум ${PALLET_MAX_BOXES} кор.`);
            }
            const boxWeightKg = productData.weightPerBoxKg ?? DEFAULT_BOX_WEIGHT_KG;
            const currentWeight = Number(pallet.totalWeightKg);
            const existingWeight = existingBoxes * boxWeightKg;
            const newWeight = currentWeight - existingWeight + dto.boxes * boxWeightKg;
            if (newWeight > PALLET_MAX_WEIGHT_KG) {
                throw new common_1.BadRequestException(`Превышен максимальный вес паллеты: ${newWeight.toFixed(0)} кг > ${PALLET_MAX_WEIGHT_KG} кг`);
            }
            if (pallet.orderId) {
                const order = await em.findOne(order_entity_1.Order, { where: { id: pallet.orderId } });
                if (order?.truckType) {
                    const limits = TRUCK_LIMITS[order.truckType];
                    const orderPallets = await em.find(pallet_entity_1.Pallet, { where: { orderId: pallet.orderId } });
                    const currentPallets = orderPallets.length;
                    const currentOrderWeightKg = orderPallets.reduce((s, p) => s + Number(p.totalWeightKg), 0);
                    const newOrderWeightKg = currentOrderWeightKg + dto.boxes * boxWeightKg;
                    if (currentPallets > limits.maxPallets) {
                        throw new common_1.BadRequestException(`Превышен лимит паллет: ${currentPallets} из ${limits.maxPallets}`);
                    }
                    if (newOrderWeightKg > limits.maxWeightKg) {
                        throw new common_1.BadRequestException(`Превышен лимит веса грузовика: ${newOrderWeightKg.toFixed(0)}кг из ${limits.maxWeightKg}кг`);
                    }
                }
            }
            let item = existingItem;
            if (item) {
                item.boxes = item.boxes + dto.boxes;
                item.priceEur = productData.priceEur;
                item.subtotalEur = Number((productData.priceEur * item.boxes).toFixed(2));
            }
            else {
                item = em.create(pallet_entity_1.PalletItem, {
                    palletId: pallet.id,
                    productId: dto.productId,
                    priceEur: productData.priceEur,
                    boxes: dto.boxes,
                    subtotalEur: Number((productData.priceEur * dto.boxes).toFixed(2)),
                });
            }
            await em.save(pallet_entity_1.PalletItem, item);
            await this.recalcPallet(em, pallet.id);
            return item;
        });
    }
    async findItemById(itemId, palletId) {
        const item = await this.items.findOne({ where: { id: itemId, palletId } });
        if (!item)
            throw new common_1.NotFoundException(`Позиция #${itemId} не найдена`);
        return item;
    }
    async updateItem(palletId, itemId, companyId, dto, productData) {
        return this.ds.transaction(async (em) => {
            const pallet = await em.findOne(pallet_entity_1.Pallet, {
                where: { id: palletId, companyId },
                relations: ['items'],
            });
            if (!pallet)
                throw new common_1.NotFoundException(`Паллета #${palletId} не найдена`);
            this.assertEditable(pallet);
            const item = pallet.items.find(i => i.id === itemId);
            if (!item)
                throw new common_1.NotFoundException(`Позиция #${itemId} не найдена`);
            const oldBoxes = item.boxes;
            const newBoxes = dto.boxes;
            const boxWeightKg = productData.weightPerBoxKg ?? DEFAULT_BOX_WEIGHT_KG;
            if (newBoxes <= 0) {
                await em.remove(pallet_entity_1.PalletItem, item);
                await this.recalcPallet(em, palletId);
                return item;
            }
            const currentBoxes = pallet.items.reduce((s, i) => s + i.boxes, 0);
            const newTotalBoxes = currentBoxes - oldBoxes + newBoxes;
            const currentWeight = Number(pallet.totalWeightKg);
            const newWeight = currentWeight - oldBoxes * boxWeightKg + newBoxes * boxWeightKg;
            if (newBoxes > oldBoxes) {
                if (newTotalBoxes > PALLET_MAX_BOXES) {
                    throw new common_1.BadRequestException(`Паллета переполнена: ${newTotalBoxes} кор. > максимум ${PALLET_MAX_BOXES} кор.`);
                }
                if (newWeight > PALLET_MAX_WEIGHT_KG) {
                    throw new common_1.BadRequestException(`Превышен максимальный вес паллеты: ${newWeight.toFixed(0)} кг > ${PALLET_MAX_WEIGHT_KG} кг`);
                }
            }
            item.boxes = newBoxes;
            item.priceEur = productData.priceEur;
            item.subtotalEur = Number((productData.priceEur * newBoxes).toFixed(2));
            await em.save(pallet_entity_1.PalletItem, item);
            await this.recalcPallet(em, palletId);
            return item;
        });
    }
    async removeItem(palletId, itemId, companyId) {
        return this.ds.transaction(async (em) => {
            const pallet = await em.findOne(pallet_entity_1.Pallet, {
                where: { id: palletId, companyId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!pallet)
                throw new common_1.NotFoundException(`Паллета #${palletId} не найдена`);
            this.assertEditable(pallet);
            const item = await em.findOne(pallet_entity_1.PalletItem, { where: { id: itemId, palletId } });
            if (!item)
                throw new common_1.NotFoundException(`Позиция #${itemId} не найдена`);
            await em.remove(pallet_entity_1.PalletItem, item);
            await this.recalcPallet(em, palletId);
        });
    }
    async assignPalletsToTruck(truckId, orderId, companyId, dto) {
        return this.ds.transaction(async (em) => {
            const truck = await em.findOne(truck_entity_1.Truck, {
                where: { id: truckId, orderId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!truck)
                throw new common_1.NotFoundException(`Фура #${truckId} не найдена`);
            await em.update(pallet_entity_1.Pallet, { truckId, companyId }, { truckId: null, status: pallet_entity_1.PalletStatus.READY });
            if (dto.palletIds.length === 0) {
                return { truck, pallets: [] };
            }
            const pallets = await em.find(pallet_entity_1.Pallet, {
                where: dto.palletIds.map(pid => ({ id: pid, companyId })),
                relations: ['items'],
            });
            if (pallets.length !== dto.palletIds.length) {
                throw new common_1.BadRequestException('Некоторые паллеты не найдены или принадлежат другой компании');
            }
            const locked = pallets.filter(p => p.status === pallet_entity_1.PalletStatus.LOCKED);
            if (locked.length) {
                throw new common_1.ForbiddenException(`Паллеты [${locked.map(p => p.id).join(',')}] заблокированы`);
            }
            const totalPallets = pallets.length;
            const totalWeight = pallets.reduce((s, p) => s + Number(p.totalWeightKg), 0);
            if (totalPallets > truck.maxPallets) {
                throw new common_1.BadRequestException(`Фура вмещает ${truck.maxPallets} паллет, запрошено ${totalPallets}`);
            }
            if (totalWeight > Number(truck.maxWeightKg)) {
                throw new common_1.BadRequestException(`Превышен вес фуры: ${totalWeight.toFixed(0)} кг > ${truck.maxWeightKg} кг`);
            }
            for (const pallet of pallets) {
                pallet.truckId = truckId;
                pallet.orderId = orderId;
                pallet.status = pallet_entity_1.PalletStatus.ASSIGNED;
            }
            await em.save(pallet_entity_1.Pallet, pallets);
            this.logger.log(`Фура #${truckId}: назначено ${totalPallets} пал., ${totalWeight.toFixed(0)} кг`);
            return { truck, pallets };
        });
    }
    async removePalletFromTruck(palletId, companyId) {
        const pallet = await this.findOne(palletId, companyId);
        if (pallet.status === pallet_entity_1.PalletStatus.LOCKED) {
            throw new common_1.ForbiddenException('Паллета заблокирована — окно редактирования закрыто');
        }
        pallet.truckId = null;
        pallet.status = pallet_entity_1.PalletStatus.READY;
        return this.pallets.save(pallet);
    }
    async getTrucksSummary(orderId, companyId) {
        const trucks = await this.trucks.find({
            where: { orderId },
            order: { number: 'ASC' },
        });
        const allPallets = await this.pallets.find({
            where: { orderId, companyId },
            relations: ['items'],
        });
        return trucks.map(truck => {
            const pallets = allPallets.filter(p => p.truckId === truck.id);
            const totalWeightKg = pallets.reduce((s, p) => s + Number(p.totalWeightKg), 0);
            return {
                truck,
                pallets,
                palletCount: pallets.length,
                totalWeightKg,
                palletFillPct: Math.round((pallets.length / truck.maxPallets) * 100),
                weightFillPct: Math.round((totalWeightKg / Number(truck.maxWeightKg)) * 100),
            };
        });
    }
    async getUnassigned(orderId, companyId) {
        return this.pallets.find({
            where: { orderId, companyId, truckId: null },
            relations: ['items'],
            order: { createdAt: 'ASC' },
        });
    }
    async lockAll(orderId, companyId) {
        return this.ds.transaction(async (em) => {
            const unassigned = await em.find(pallet_entity_1.Pallet, {
                where: { orderId, companyId, truckId: null },
            });
            let autoAssigned = 0;
            if (unassigned.length > 0) {
                autoAssigned = await this.autoDistribute(em, orderId, unassigned);
            }
            const { affected } = await em.update(pallet_entity_1.Pallet, { orderId, companyId }, { status: pallet_entity_1.PalletStatus.LOCKED });
            this.logger.log(`Заказ #${orderId}: заблокировано ${affected} паллет, авто-назначено ${autoAssigned}`);
            return { locked: affected ?? 0, autoAssigned };
        });
    }
    async recalcPallet(em, palletId) {
        const rows = await em
            .createQueryBuilder(pallet_entity_1.PalletItem, 'i')
            .select('SUM(i.boxes)', 'totalBoxes')
            .addSelect('SUM(i.subtotal)', 'totalAmountEur')
            .where('i.pallet_id = :palletId', { palletId })
            .getRawOne();
        const totalBoxes = Number(rows?.totalBoxes ?? 0);
        const totalAmountEur = Number(rows?.totalAmountEur ?? 0);
        const totalWeightKg = totalBoxes * DEFAULT_BOX_WEIGHT_KG;
        await em.update(pallet_entity_1.Pallet, palletId, { totalBoxes, totalWeightKg, totalAmountEur });
    }
    async autoDistribute(em, orderId, pallets) {
        const trucks = await em.find(truck_entity_1.Truck, {
            where: { orderId },
            order: { number: 'ASC' },
        });
        if (!trucks.length)
            return 0;
        let assigned = 0;
        let ti = 0;
        const slots = await Promise.all(trucks.map(t => em.count(pallet_entity_1.Pallet, { where: { truckId: t.id } })));
        for (const pallet of pallets) {
            while (ti < trucks.length && slots[ti] >= trucks[ti].maxPallets)
                ti++;
            if (ti >= trucks.length)
                break;
            pallet.truckId = trucks[ti].id;
            pallet.status = pallet_entity_1.PalletStatus.ASSIGNED;
            await em.save(pallet_entity_1.Pallet, pallet);
            slots[ti]++;
            assigned++;
        }
        return assigned;
    }
    assertEditable(pallet) {
        if (!pallet.isEditable) {
            throw new common_1.ForbiddenException(`Паллета #${pallet.id} заблокирована (статус: ${pallet.status})`);
        }
    }
    async assignToTruck(pallet, truckId) {
        if (truckId === null) {
            pallet.truckId = null;
            pallet.status = pallet_entity_1.PalletStatus.READY;
            return;
        }
        const truck = await this.trucks.findOne({ where: { id: truckId } });
        if (!truck)
            throw new common_1.NotFoundException(`Фура #${truckId} не найдена`);
        const currentCount = await this.pallets.count({ where: { truckId } });
        if (currentCount >= truck.maxPallets) {
            throw new common_1.BadRequestException(`Фура #${truckId} заполнена (${currentCount}/${truck.maxPallets} паллет)`);
        }
        pallet.truckId = truckId;
        pallet.status = pallet_entity_1.PalletStatus.ASSIGNED;
    }
};
exports.PalletsService = PalletsService;
exports.PalletsService = PalletsService = PalletsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(pallet_entity_1.Pallet)),
    __param(1, (0, typeorm_1.InjectRepository)(pallet_entity_1.PalletItem)),
    __param(2, (0, typeorm_1.InjectRepository)(truck_entity_1.Truck)),
    __param(3, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], PalletsService);
//# sourceMappingURL=pallets.service.js.map