"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const common_1 = require("@nestjs/common");
const orders_service_1 = require("./orders.service");
const order_entity_1 = require("./entities/order.entity");
const order_status_history_entity_1 = require("./entities/order-status-history.entity");
const TODAY = '2025-06-01';
const FUTURE = '2025-07-01';
const PAST = '2020-01-01';
function makeOrder(overrides = {}) {
    return Object.assign(new order_entity_1.Order(), {
        id: 1,
        companyId: 1,
        status: order_entity_1.OrderStatus.DRAFT,
        proposedDate: null,
        confirmedDate: null,
        proposedBy: null,
        confirmedBy: null,
        lockedBy: null,
        shippedBy: null,
        truckCount: 1,
        totalPallets: 0,
        totalWeightKg: null,
        totalAmountEur: null,
        notes: null,
        windowOpensAt: null,
        windowClosesAt: null,
        shippedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        get isPalletWindowOpen() {
            if (!this.windowOpensAt || !this.windowClosesAt)
                return false;
            const now = new Date();
            return now >= this.windowOpensAt && now <= this.windowClosesAt;
        },
        get isEditable() {
            return ![order_entity_1.OrderStatus.SHIPPED, order_entity_1.OrderStatus.CANCELLED].includes(this.status);
        },
        canTransitionTo(next) {
            const map = {
                draft: [order_entity_1.OrderStatus.NEGOTIATING, order_entity_1.OrderStatus.CANCELLED],
                negotiating: [order_entity_1.OrderStatus.CONFIRMED, order_entity_1.OrderStatus.CANCELLED],
                confirmed: [order_entity_1.OrderStatus.BUILDING, order_entity_1.OrderStatus.CANCELLED],
                building: [order_entity_1.OrderStatus.LOCKED, order_entity_1.OrderStatus.CANCELLED],
                locked: [order_entity_1.OrderStatus.SHIPPED, order_entity_1.OrderStatus.CANCELLED],
                shipped: [],
                cancelled: [],
            };
            return (map[this.status] ?? []).includes(next);
        },
        ...overrides,
    });
}
function makeRepo() {
    return {
        create: jest.fn().mockImplementation(d => ({ ...d })),
        save: jest.fn().mockImplementation(e => Promise.resolve(e)),
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        createQueryBuilder: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            clone: jest.fn().mockReturnThis(),
            getCount: jest.fn().mockResolvedValue(0),
            getMany: jest.fn().mockResolvedValue([]),
        }),
    };
}
describe('OrdersService', () => {
    let service;
    let orderRepo;
    let historyRepo;
    beforeEach(async () => {
        orderRepo = makeRepo();
        historyRepo = makeRepo();
        const module = await testing_1.Test.createTestingModule({
            providers: [
                orders_service_1.OrdersService,
                { provide: (0, typeorm_1.getRepositoryToken)(order_entity_1.Order), useValue: orderRepo },
                { provide: (0, typeorm_1.getRepositoryToken)(order_status_history_entity_1.OrderStatusHistory), useValue: historyRepo },
                { provide: typeorm_2.DataSource, useValue: {} },
            ],
        }).compile();
        service = module.get(orders_service_1.OrdersService);
    });
    afterEach(() => jest.clearAllMocks());
    describe('create', () => {
        it('создаёт заказ в статусе draft', async () => {
            const order = makeOrder();
            orderRepo.create.mockReturnValue(order);
            orderRepo.save.mockResolvedValue(order);
            const result = await service.create(1, 10, {});
            expect(result.status).toBe(order_entity_1.OrderStatus.DRAFT);
            expect(orderRepo.save).toHaveBeenCalled();
        });
        it('создаёт и сразу переходит в negotiating если передана proposedDate', async () => {
            const draft = makeOrder({ status: order_entity_1.OrderStatus.DRAFT });
            const negotiating = makeOrder({ status: order_entity_1.OrderStatus.NEGOTIATING, proposedDate: FUTURE });
            orderRepo.create.mockReturnValue(draft);
            orderRepo.save
                .mockResolvedValueOnce(draft)
                .mockResolvedValue(negotiating);
            orderRepo.findOne.mockResolvedValue(draft);
            const result = await service.create(1, 10, { proposedDate: FUTURE });
            expect(result.status).toBe(order_entity_1.OrderStatus.NEGOTIATING);
        });
    });
    describe('proposeDate', () => {
        it('draft → negotiating при валидной дате', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.DRAFT });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.proposeDate(1, 1, 10, { proposedDate: FUTURE });
            expect(result.status).toBe(order_entity_1.OrderStatus.NEGOTIATING);
            expect(result.proposedDate).toBe(FUTURE);
            expect(historyRepo.save).toHaveBeenCalled();
        });
        it('повторное предложение в negotiating разрешено', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.NEGOTIATING });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.proposeDate(1, 1, 10, { proposedDate: FUTURE });
            expect(result.status).toBe(order_entity_1.OrderStatus.NEGOTIATING);
        });
        it('отклоняет прошедшую дату', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.DRAFT });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.proposeDate(1, 1, 10, { proposedDate: PAST })).rejects.toThrow(common_1.BadRequestException);
        });
        it('отклоняет предложение не своего заказа', async () => {
            const order = makeOrder({ companyId: 99 });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.proposeDate(1, 1, 10, { proposedDate: FUTURE })).rejects.toThrow(common_1.ForbiddenException);
        });
        it('отклоняет если статус confirmed', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.CONFIRMED });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.proposeDate(1, 1, 10, { proposedDate: FUTURE })).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('confirmDate', () => {
        it('negotiating → confirmed, вычисляет окно паллет', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.NEGOTIATING });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.confirmDate(1, 20, { confirmedDate: FUTURE });
            expect(result.status).toBe(order_entity_1.OrderStatus.CONFIRMED);
            expect(result.confirmedDate).toBe(FUTURE);
            expect(result.windowOpensAt).toBeDefined();
            expect(result.windowClosesAt).toBeDefined();
            const opens = new Date(result.windowOpensAt);
            const closes = new Date(result.windowClosesAt);
            const loading = new Date(FUTURE);
            const diffOpen = Math.round((loading.getTime() - opens.getTime()) / 86400000);
            const diffClose = Math.round((loading.getTime() - closes.getTime()) / 86400000);
            expect(diffOpen).toBe(5);
            expect(diffClose).toBe(1);
        });
        it('window закрывается в 23:59 за 1 день до погрузки', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.NEGOTIATING });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.confirmDate(1, 20, { confirmedDate: FUTURE });
            const closes = new Date(result.windowClosesAt);
            expect(closes.getUTCHours()).toBe(23);
            expect(closes.getUTCMinutes()).toBe(59);
        });
        it('отклоняет переход из draft', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.DRAFT });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.confirmDate(1, 20, { confirmedDate: FUTURE })).rejects.toThrow(common_1.BadRequestException);
        });
        it('обновляет truckCount если передан', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.NEGOTIATING, truckCount: 1 });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.confirmDate(1, 20, {
                confirmedDate: FUTURE,
                truckCount: 3,
            });
            expect(result.truckCount).toBe(3);
        });
    });
    describe('openPalletWindow', () => {
        it('confirmed → building', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.CONFIRMED });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.openPalletWindow(1);
            expect(result.status).toBe(order_entity_1.OrderStatus.BUILDING);
        });
        it('отклоняет если статус не confirmed', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.DRAFT });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.openPalletWindow(1)).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('confirmPlan', () => {
        it('building → locked когда окно открыто', async () => {
            const now = new Date();
            const opens = new Date(now.getTime() - 3600000);
            const closes = new Date(now.getTime() + 3600000);
            const order = makeOrder({
                status: order_entity_1.OrderStatus.BUILDING,
                windowOpensAt: opens, windowClosesAt: closes,
            });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.confirmPlan(1, 1, 10, {});
            expect(result.status).toBe(order_entity_1.OrderStatus.LOCKED);
            expect(result.lockedBy).toBe(10);
        });
        it('отклоняет если окно закрыто', async () => {
            const past = new Date(Date.now() - 3600000 * 24);
            const order = makeOrder({
                status: order_entity_1.OrderStatus.BUILDING,
                windowOpensAt: new Date(Date.now() - 3600000 * 48),
                windowClosesAt: past,
            });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.confirmPlan(1, 1, 10, {})).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('autoLock', () => {
        it('building → locked автоматически', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.BUILDING });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.autoLock(1);
            expect(result.status).toBe(order_entity_1.OrderStatus.LOCKED);
        });
        it('не трогает заказы не в building', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.CONFIRMED });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.autoLock(1);
            expect(result.status).toBe(order_entity_1.OrderStatus.CONFIRMED);
            expect(orderRepo.save).not.toHaveBeenCalled();
        });
    });
    describe('ship', () => {
        it('locked → shipped', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.LOCKED });
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.ship(1, 20, {});
            expect(result.status).toBe(order_entity_1.OrderStatus.SHIPPED);
            expect(result.shippedBy).toBe(20);
            expect(result.shippedAt).toBeDefined();
        });
        it('отклоняет если статус building', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.BUILDING });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.ship(1, 20, {})).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('cancel', () => {
        it('отменяет заказ из любого промежуточного статуса', async () => {
            for (const status of [
                order_entity_1.OrderStatus.DRAFT,
                order_entity_1.OrderStatus.NEGOTIATING,
                order_entity_1.OrderStatus.CONFIRMED,
                order_entity_1.OrderStatus.BUILDING,
                order_entity_1.OrderStatus.LOCKED,
            ]) {
                const order = makeOrder({ status });
                orderRepo.findOne.mockResolvedValue(order);
                const result = await service.cancel(1, 20, { reason: 'test' });
                expect(result.status).toBe(order_entity_1.OrderStatus.CANCELLED);
            }
        });
        it('запрещает отменить shipped', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.SHIPPED });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.cancel(1, 20, {})).rejects.toThrow(common_1.ForbiddenException);
        });
        it('запрещает отменить уже отменённый', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.CANCELLED });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.cancel(1, 20, {})).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('findOne', () => {
        it('возвращает заказ если найден', async () => {
            const order = makeOrder();
            orderRepo.findOne.mockResolvedValue(order);
            const result = await service.findOne(1);
            expect(result.id).toBe(1);
        });
        it('выбрасывает NotFoundException', async () => {
            orderRepo.findOne.mockResolvedValue(null);
            await expect(service.findOne(999)).rejects.toThrow(common_1.NotFoundException);
        });
        it('выбрасывает ForbiddenException при несовпадении companyId', async () => {
            const order = makeOrder({ companyId: 99 });
            orderRepo.findOne.mockResolvedValue(order);
            await expect(service.findOne(1, 1)).rejects.toThrow(common_1.ForbiddenException);
        });
    });
    describe('calcPalletWindow (через confirmDate)', () => {
        it('window открывается за 5 дней и закрывается за 1 день до погрузки', async () => {
            const order = makeOrder({ status: order_entity_1.OrderStatus.NEGOTIATING });
            orderRepo.findOne.mockResolvedValue(order);
            const loadingDate = '2025-10-10';
            await service.confirmDate(1, 20, { confirmedDate: loadingDate });
            const saved = orderRepo.save.mock.calls[0][0];
            const opens = new Date(saved.windowOpensAt);
            const closes = new Date(saved.windowClosesAt);
            expect(opens.toISOString().slice(0, 10)).toBe('2025-10-05');
            expect(closes.toISOString().slice(0, 10)).toBe('2025-10-09');
            expect(closes.getUTCHours()).toBe(23);
            expect(closes.getUTCMinutes()).toBe(59);
        });
    });
});
//# sourceMappingURL=orders.service.spec.js.map