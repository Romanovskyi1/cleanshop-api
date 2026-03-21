"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const common_1 = require("@nestjs/common");
const pallets_service_1 = require("./pallets.service");
const pallet_entity_1 = require("./entities/pallet.entity");
const truck_entity_1 = require("../orders/entities/truck.entity");
const COMPANY_ID = 1;
const ORDER_ID = 10;
const TRUCK_ID = 100;
function makePallet(overrides = {}) {
    return Object.assign(new pallet_entity_1.Pallet(), {
        id: 1,
        companyId: COMPANY_ID,
        orderId: ORDER_ID,
        truckId: null,
        name: 'Паллета №1',
        totalBoxes: 0,
        totalWeightKg: 0,
        totalAmountEur: 0,
        status: pallet_entity_1.PalletStatus.BUILDING,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });
}
function makeTruck(overrides = {}) {
    return Object.assign(new truck_entity_1.Truck(), {
        id: TRUCK_ID,
        orderId: ORDER_ID,
        number: 1,
        maxPallets: 33,
        maxWeightKg: 24000,
        createdAt: new Date(),
        ...overrides,
    });
}
const mockRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ totalBoxes: '0', totalAmountEur: '0' }),
    }),
});
const mockDataSource = {
    transaction: jest.fn().mockImplementation(async (fn) => {
        const em = {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn((entity, data) => Object.assign(new entity(), data)),
            save: jest.fn().mockImplementation((_, e) => Promise.resolve(e ?? _)),
            remove: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ totalBoxes: '10', totalAmountEur: '124.00' }),
            }),
        };
        return fn(em);
    }),
};
describe('PalletsService', () => {
    let service;
    let palletRepo;
    let itemRepo;
    let truckRepo;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                pallets_service_1.PalletsService,
                { provide: (0, typeorm_1.getRepositoryToken)(pallet_entity_1.Pallet), useValue: mockRepo() },
                { provide: (0, typeorm_1.getRepositoryToken)(pallet_entity_1.PalletItem), useValue: mockRepo() },
                { provide: (0, typeorm_1.getRepositoryToken)(truck_entity_1.Truck), useValue: mockRepo() },
                { provide: typeorm_2.DataSource, useValue: mockDataSource },
            ],
        }).compile();
        service = module.get(pallets_service_1.PalletsService);
        palletRepo = module.get((0, typeorm_1.getRepositoryToken)(pallet_entity_1.Pallet));
        itemRepo = module.get((0, typeorm_1.getRepositoryToken)(pallet_entity_1.PalletItem));
        truckRepo = module.get((0, typeorm_1.getRepositoryToken)(truck_entity_1.Truck));
    });
    afterEach(() => jest.clearAllMocks());
    describe('create', () => {
        it('создаёт паллету с корректными дефолтами', async () => {
            const pallet = makePallet();
            palletRepo.create.mockReturnValue(pallet);
            palletRepo.save.mockResolvedValue(pallet);
            const result = await service.create(COMPANY_ID, { name: 'Паллета №1' });
            expect(palletRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                companyId: COMPANY_ID,
                status: pallet_entity_1.PalletStatus.BUILDING,
            }));
            expect(result.companyId).toBe(COMPANY_ID);
        });
    });
    describe('findOne', () => {
        it('возвращает паллету если найдена', async () => {
            const pallet = makePallet();
            palletRepo.findOne.mockResolvedValue(pallet);
            const result = await service.findOne(1, COMPANY_ID);
            expect(result.id).toBe(1);
        });
        it('выбрасывает NotFoundException если паллета не найдена', async () => {
            palletRepo.findOne.mockResolvedValue(null);
            await expect(service.findOne(999, COMPANY_ID)).rejects.toThrow(common_1.NotFoundException);
        });
    });
    describe('remove', () => {
        it('удаляет редактируемую паллету', async () => {
            const pallet = makePallet({ status: pallet_entity_1.PalletStatus.BUILDING });
            palletRepo.findOne.mockResolvedValue(pallet);
            palletRepo.remove.mockResolvedValue(pallet);
            await service.remove(1, COMPANY_ID);
            expect(palletRepo.remove).toHaveBeenCalledWith(pallet);
        });
        it('запрещает удалять заблокированную паллету', async () => {
            const pallet = makePallet({ status: pallet_entity_1.PalletStatus.LOCKED });
            palletRepo.findOne.mockResolvedValue(pallet);
            await expect(service.remove(1, COMPANY_ID)).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    describe('addItem', () => {
        const productData = { priceEur: 12.40, unitsPerBox: 24, weightPerBoxKg: 15 };
        it('добавляет позицию в пустую паллету', async () => {
            const pallet = makePallet({ items: [] });
            mockDataSource.transaction.mockImplementationOnce(async (fn) => {
                const em = {
                    findOne: jest.fn().mockResolvedValue(pallet),
                    find: jest.fn(),
                    create: jest.fn().mockImplementation((_, d) => ({ ...d })),
                    save: jest.fn().mockResolvedValue({}),
                    update: jest.fn(),
                    createQueryBuilder: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnThis(),
                        addSelect: jest.fn().mockReturnThis(),
                        where: jest.fn().mockReturnThis(),
                        getRawOne: jest.fn().mockResolvedValue({ totalBoxes: '24', totalAmountEur: '297.60' }),
                    }),
                };
                return fn(em);
            });
            await service.addItem(1, COMPANY_ID, { productId: 1, boxes: 24 }, productData);
        });
        it('отклоняет некратное количество коробок', async () => {
            const pallet = makePallet({ items: [] });
            mockDataSource.transaction.mockImplementationOnce(async (fn) => {
                const em = { findOne: jest.fn().mockResolvedValue(pallet) };
                return fn(em);
            });
            await expect(service.addItem(1, COMPANY_ID, { productId: 1, boxes: 7 }, productData)).rejects.toThrow(common_1.BadRequestException);
        });
        it('отклоняет переполнение паллеты (> 40 коробок)', async () => {
            const existingItem = { productId: 99, boxes: 40, subtotalEur: 100 };
            const pallet = makePallet({ items: [existingItem], totalBoxes: 40 });
            mockDataSource.transaction.mockImplementationOnce(async (fn) => {
                const em = { findOne: jest.fn().mockResolvedValue(pallet) };
                return fn(em);
            });
            await expect(service.addItem(1, COMPANY_ID, { productId: 1, boxes: 24 }, productData)).rejects.toThrow(common_1.BadRequestException);
        });
        it('запрещает добавлять в заблокированную паллету', async () => {
            const pallet = makePallet({ status: pallet_entity_1.PalletStatus.LOCKED, items: [] });
            mockDataSource.transaction.mockImplementationOnce(async (fn) => {
                const em = { findOne: jest.fn().mockResolvedValue(pallet) };
                return fn(em);
            });
            await expect(service.addItem(1, COMPANY_ID, { productId: 1, boxes: 24 }, productData)).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    describe('assignPalletsToTruck', () => {
        it('назначает паллеты в фуру при достаточной вместимости', async () => {
            const truck = makeTruck();
            const pallet = makePallet({ id: 1, totalWeightKg: 600 });
            mockDataSource.transaction.mockImplementationOnce(async (fn) => {
                const em = {
                    findOne: jest.fn().mockResolvedValue(truck),
                    find: jest.fn().mockResolvedValue([pallet]),
                    update: jest.fn(),
                    save: jest.fn().mockResolvedValue(pallet),
                };
                return fn(em);
            });
            const result = await service.assignPalletsToTruck(TRUCK_ID, ORDER_ID, COMPANY_ID, { palletIds: [1] });
            expect(result.pallets).toHaveLength(1);
        });
        it('отклоняет превышение вместимости фуры (паллеты)', async () => {
            const truck = makeTruck({ maxPallets: 2 });
            const pallets = Array.from({ length: 3 }, (_, i) => makePallet({ id: i + 1, totalWeightKg: 200 }));
            mockDataSource.transaction.mockImplementationOnce(async (fn) => {
                const em = {
                    findOne: jest.fn().mockResolvedValue(truck),
                    find: jest.fn().mockResolvedValue(pallets),
                    update: jest.fn(),
                };
                return fn(em);
            });
            await expect(service.assignPalletsToTruck(TRUCK_ID, ORDER_ID, COMPANY_ID, { palletIds: [1, 2, 3] })).rejects.toThrow(common_1.BadRequestException);
        });
        it('отклоняет превышение веса фуры', async () => {
            const truck = makeTruck({ maxWeightKg: 1000 });
            const pallet = makePallet({ id: 1, totalWeightKg: 1500 });
            mockDataSource.transaction.mockImplementationOnce(async (fn) => {
                const em = {
                    findOne: jest.fn().mockResolvedValue(truck),
                    find: jest.fn().mockResolvedValue([pallet]),
                    update: jest.fn(),
                };
                return fn(em);
            });
            await expect(service.assignPalletsToTruck(TRUCK_ID, ORDER_ID, COMPANY_ID, { palletIds: [1] })).rejects.toThrow(common_1.BadRequestException);
        });
        it('выбрасывает NotFoundException если фура не найдена', async () => {
            mockDataSource.transaction.mockImplementationOnce(async (fn) => {
                const em = { findOne: jest.fn().mockResolvedValue(null), update: jest.fn() };
                return fn(em);
            });
            await expect(service.assignPalletsToTruck(999, ORDER_ID, COMPANY_ID, { palletIds: [1] })).rejects.toThrow(common_1.NotFoundException);
        });
    });
    describe('lockAll', () => {
        it('блокирует все паллеты заказа', async () => {
            mockDataSource.transaction.mockImplementationOnce(async (fn) => {
                const em = {
                    find: jest.fn().mockResolvedValue([]),
                    update: jest.fn().mockResolvedValue({ affected: 5 }),
                };
                return fn(em);
            });
            const result = await service.lockAll(ORDER_ID, COMPANY_ID);
            expect(result.locked).toBe(5);
            expect(result.autoAssigned).toBe(0);
        });
    });
});
//# sourceMappingURL=pallets.service.spec.js.map