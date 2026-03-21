// src/orders/orders.service.spec.ts
import { Test, TestingModule }     from '@nestjs/testing';
import { getRepositoryToken }      from '@nestjs/typeorm';
import { DataSource }              from 'typeorm';
import {
  BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';

import { OrdersService }           from './orders.service';
import { Order, OrderStatus }      from './entities/order.entity';
import { OrderStatusHistory }      from './entities/order-status-history.entity';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY   = '2025-06-01';
const FUTURE  = '2025-07-01';
const PAST    = '2020-01-01';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return Object.assign(new Order(), {
    id:            1,
    companyId:     1,
    status:        OrderStatus.DRAFT,
    proposedDate:  null,
    confirmedDate: null,
    proposedBy:    null,
    confirmedBy:   null,
    lockedBy:      null,
    shippedBy:     null,
    truckCount:    1,
    totalPallets:  0,
    totalWeightKg: null,
    totalAmountEur: null,
    notes:         null,
    windowOpensAt:  null,
    windowClosesAt: null,
    shippedAt:      null,
    createdAt:     new Date(),
    updatedAt:     new Date(),
    get isPalletWindowOpen() {
      if (!this.windowOpensAt || !this.windowClosesAt) return false;
      const now = new Date();
      return now >= this.windowOpensAt && now <= this.windowClosesAt;
    },
    get isEditable() {
      return ![OrderStatus.SHIPPED, OrderStatus.CANCELLED].includes(this.status);
    },
    canTransitionTo(next: OrderStatus) {
      const map: Record<string, OrderStatus[]> = {
        draft:       [OrderStatus.NEGOTIATING, OrderStatus.CANCELLED],
        negotiating: [OrderStatus.CONFIRMED,   OrderStatus.CANCELLED],
        confirmed:   [OrderStatus.BUILDING,    OrderStatus.CANCELLED],
        building:    [OrderStatus.LOCKED,      OrderStatus.CANCELLED],
        locked:      [OrderStatus.SHIPPED,     OrderStatus.CANCELLED],
        shipped:     [],
        cancelled:   [],
      };
      return (map[this.status] ?? []).includes(next);
    },
    ...overrides,
  });
}

// ── Mocks ──────────────────────────────────────────────────────────────────────

function makeRepo() {
  return {
    create:             jest.fn().mockImplementation(d => ({ ...d })),
    save:               jest.fn().mockImplementation(e => Promise.resolve(e)),
    find:               jest.fn().mockResolvedValue([]),
    findOne:            jest.fn(),
    count:              jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue({
      where:    jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy:  jest.fn().mockReturnThis(),
      skip:     jest.fn().mockReturnThis(),
      take:     jest.fn().mockReturnThis(),
      clone:    jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany:  jest.fn().mockResolvedValue([]),
    }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  let service:     OrdersService;
  let orderRepo:   ReturnType<typeof makeRepo>;
  let historyRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    orderRepo   = makeRepo();
    historyRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order),              useValue: orderRepo },
        { provide: getRepositoryToken(OrderStatusHistory), useValue: historyRepo },
        { provide: DataSource,                             useValue: {} },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('создаёт заказ в статусе draft', async () => {
      const order = makeOrder();
      orderRepo.create.mockReturnValue(order);
      orderRepo.save.mockResolvedValue(order);

      const result = await service.create(1, 10, {});
      expect(result.status).toBe(OrderStatus.DRAFT);
      expect(orderRepo.save).toHaveBeenCalled();
    });

    it('создаёт и сразу переходит в negotiating если передана proposedDate', async () => {
      const draft = makeOrder({ status: OrderStatus.DRAFT });
      const negotiating = makeOrder({ status: OrderStatus.NEGOTIATING, proposedDate: FUTURE });

      orderRepo.create.mockReturnValue(draft);
      // первый save — черновик, второй save — negotiating
      orderRepo.save
        .mockResolvedValueOnce(draft)
        .mockResolvedValue(negotiating);
      orderRepo.findOne.mockResolvedValue(draft);

      const result = await service.create(1, 10, { proposedDate: FUTURE });
      expect(result.status).toBe(OrderStatus.NEGOTIATING);
    });
  });

  // ── proposeDate ─────────────────────────────────────────────────────────────

  describe('proposeDate', () => {
    it('draft → negotiating при валидной дате', async () => {
      const order = makeOrder({ status: OrderStatus.DRAFT });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.proposeDate(1, 1, 10, { proposedDate: FUTURE });
      expect(result.status).toBe(OrderStatus.NEGOTIATING);
      expect(result.proposedDate).toBe(FUTURE);
      expect(historyRepo.save).toHaveBeenCalled();
    });

    it('повторное предложение в negotiating разрешено', async () => {
      const order = makeOrder({ status: OrderStatus.NEGOTIATING });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.proposeDate(1, 1, 10, { proposedDate: FUTURE });
      expect(result.status).toBe(OrderStatus.NEGOTIATING);
    });

    it('отклоняет прошедшую дату', async () => {
      const order = makeOrder({ status: OrderStatus.DRAFT });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(
        service.proposeDate(1, 1, 10, { proposedDate: PAST }),
      ).rejects.toThrow(BadRequestException);
    });

    it('отклоняет предложение не своего заказа', async () => {
      const order = makeOrder({ companyId: 99 });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(
        service.proposeDate(1, 1, 10, { proposedDate: FUTURE }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('отклоняет если статус confirmed', async () => {
      const order = makeOrder({ status: OrderStatus.CONFIRMED });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(
        service.proposeDate(1, 1, 10, { proposedDate: FUTURE }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── confirmDate ─────────────────────────────────────────────────────────────

  describe('confirmDate', () => {
    it('negotiating → confirmed, вычисляет окно паллет', async () => {
      const order = makeOrder({ status: OrderStatus.NEGOTIATING });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.confirmDate(1, 20, { confirmedDate: FUTURE });

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(result.confirmedDate).toBe(FUTURE);
      expect(result.windowOpensAt).toBeDefined();
      expect(result.windowClosesAt).toBeDefined();
      // Окно открывается за 5 дней до погрузки
      const opens  = new Date(result.windowOpensAt!);
      const closes = new Date(result.windowClosesAt!);
      const loading = new Date(FUTURE);
      const diffOpen  = Math.round((loading.getTime() - opens.getTime()) / 86400000);
      const diffClose = Math.round((loading.getTime() - closes.getTime()) / 86400000);
      expect(diffOpen).toBe(5);
      expect(diffClose).toBe(1);
    });

    it('window закрывается в 23:59 за 1 день до погрузки', async () => {
      const order = makeOrder({ status: OrderStatus.NEGOTIATING });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.confirmDate(1, 20, { confirmedDate: FUTURE });
      const closes = new Date(result.windowClosesAt!);

      expect(closes.getUTCHours()).toBe(23);
      expect(closes.getUTCMinutes()).toBe(59);
    });

    it('отклоняет переход из draft', async () => {
      const order = makeOrder({ status: OrderStatus.DRAFT });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(
        service.confirmDate(1, 20, { confirmedDate: FUTURE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('обновляет truckCount если передан', async () => {
      const order = makeOrder({ status: OrderStatus.NEGOTIATING, truckCount: 1 });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.confirmDate(1, 20, {
        confirmedDate: FUTURE,
        truckCount: 3,
      });
      expect(result.truckCount).toBe(3);
    });
  });

  // ── openPalletWindow ────────────────────────────────────────────────────────

  describe('openPalletWindow', () => {
    it('confirmed → building', async () => {
      const order = makeOrder({ status: OrderStatus.CONFIRMED });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.openPalletWindow(1);
      expect(result.status).toBe(OrderStatus.BUILDING);
    });

    it('отклоняет если статус не confirmed', async () => {
      const order = makeOrder({ status: OrderStatus.DRAFT });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(service.openPalletWindow(1)).rejects.toThrow(BadRequestException);
    });
  });

  // ── confirmPlan ─────────────────────────────────────────────────────────────

  describe('confirmPlan', () => {
    it('building → locked когда окно открыто', async () => {
      const now = new Date();
      const opens  = new Date(now.getTime() - 3600000); // час назад
      const closes = new Date(now.getTime() + 3600000); // через час
      const order = makeOrder({
        status: OrderStatus.BUILDING,
        windowOpensAt: opens, windowClosesAt: closes,
      });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.confirmPlan(1, 1, 10, {});
      expect(result.status).toBe(OrderStatus.LOCKED);
      expect(result.lockedBy).toBe(10);
    });

    it('отклоняет если окно закрыто', async () => {
      const past = new Date(Date.now() - 3600000 * 24);
      const order = makeOrder({
        status: OrderStatus.BUILDING,
        windowOpensAt: new Date(Date.now() - 3600000 * 48),
        windowClosesAt: past,
      });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(service.confirmPlan(1, 1, 10, {})).rejects.toThrow(BadRequestException);
    });
  });

  // ── autoLock ────────────────────────────────────────────────────────────────

  describe('autoLock', () => {
    it('building → locked автоматически', async () => {
      const order = makeOrder({ status: OrderStatus.BUILDING });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.autoLock(1);
      expect(result.status).toBe(OrderStatus.LOCKED);
    });

    it('не трогает заказы не в building', async () => {
      const order = makeOrder({ status: OrderStatus.CONFIRMED });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.autoLock(1);
      expect(result.status).toBe(OrderStatus.CONFIRMED); // не изменился
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── ship ────────────────────────────────────────────────────────────────────

  describe('ship', () => {
    it('locked → shipped', async () => {
      const order = makeOrder({ status: OrderStatus.LOCKED });
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.ship(1, 20, {});
      expect(result.status).toBe(OrderStatus.SHIPPED);
      expect(result.shippedBy).toBe(20);
      expect(result.shippedAt).toBeDefined();
    });

    it('отклоняет если статус building', async () => {
      const order = makeOrder({ status: OrderStatus.BUILDING });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(service.ship(1, 20, {})).rejects.toThrow(BadRequestException);
    });
  });

  // ── cancel ──────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('отменяет заказ из любого промежуточного статуса', async () => {
      for (const status of [
        OrderStatus.DRAFT,
        OrderStatus.NEGOTIATING,
        OrderStatus.CONFIRMED,
        OrderStatus.BUILDING,
        OrderStatus.LOCKED,
      ]) {
        const order = makeOrder({ status });
        orderRepo.findOne.mockResolvedValue(order);

        const result = await service.cancel(1, 20, { reason: 'test' });
        expect(result.status).toBe(OrderStatus.CANCELLED);
      }
    });

    it('запрещает отменить shipped', async () => {
      const order = makeOrder({ status: OrderStatus.SHIPPED });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(service.cancel(1, 20, {})).rejects.toThrow(ForbiddenException);
    });

    it('запрещает отменить уже отменённый', async () => {
      const order = makeOrder({ status: OrderStatus.CANCELLED });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(service.cancel(1, 20, {})).rejects.toThrow(BadRequestException);
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('возвращает заказ если найден', async () => {
      const order = makeOrder();
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.findOne(1);
      expect(result.id).toBe(1);
    });

    it('выбрасывает NotFoundException', async () => {
      orderRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('выбрасывает ForbiddenException при несовпадении companyId', async () => {
      const order = makeOrder({ companyId: 99 });
      orderRepo.findOne.mockResolvedValue(order);

      await expect(service.findOne(1, 1)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── calcPalletWindow (internal) ─────────────────────────────────────────────

  describe('calcPalletWindow (через confirmDate)', () => {
    it('window открывается за 5 дней и закрывается за 1 день до погрузки', async () => {
      const order = makeOrder({ status: OrderStatus.NEGOTIATING });
      orderRepo.findOne.mockResolvedValue(order);

      const loadingDate = '2025-10-10'; // пятница
      await service.confirmDate(1, 20, { confirmedDate: loadingDate });

      const saved = orderRepo.save.mock.calls[0][0] as Order;
      const opens  = new Date(saved.windowOpensAt!);   // 2025-10-05
      const closes = new Date(saved.windowClosesAt!);  // 2025-10-09 23:59

      expect(opens.toISOString().slice(0, 10)).toBe('2025-10-05');
      expect(closes.toISOString().slice(0, 10)).toBe('2025-10-09');
      expect(closes.getUTCHours()).toBe(23);
      expect(closes.getUTCMinutes()).toBe(59);
    });
  });
});
