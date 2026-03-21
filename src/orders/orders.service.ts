// src/orders/orders.service.ts
import {
  Injectable, Logger, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { Order, OrderStatus, ALLOWED_TRANSITIONS } from './entities/order.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import {
  CreateOrderDto, ProposeDateDto, ConfirmDateDto,
  ConfirmPlanDto, CancelOrderDto, ShipOrderDto,
  UpdateOrderDto, OrderQueryDto,
} from './dto/order.dto';

// За сколько дней до погрузки открывается окно паллет
const WINDOW_DAYS_BEFORE = 5;
// За сколько часов до конца дня закрывается окно (23:59)
const WINDOW_CLOSE_HOUR  = 23;
const WINDOW_CLOSE_MIN   = 59;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,

    @InjectRepository(OrderStatusHistory)
    private readonly history: Repository<OrderStatusHistory>,

    private readonly ds: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Создать черновик заказа.
   * Клиент может сразу предложить дату или оставить пустой.
   */
  async create(
    companyId: number,
    actorId:   number,
    dto:       CreateOrderDto,
  ): Promise<Order> {
    let order = this.orders.create({
      companyId,
      truckCount:   dto.truckCount ?? 1,
      notes:        dto.notes ?? null,
      status:       OrderStatus.DRAFT,
    });

    order = await this.orders.save(order);

    await this.writeHistory(order.id, null, OrderStatus.DRAFT, actorId, 'client', 'Заказ создан');

    // Если клиент сразу предложил дату — переводим в negotiating
    if (dto.proposedDate) {
      order = await this.proposeDate(order.id, companyId, actorId, { proposedDate: dto.proposedDate });
    }

    this.logger.log(`Order #${order.id} created for company ${companyId}`);
    return order;
  }

  /**
   * Список заказов.
   * Клиент видит только свои. Менеджер — все.
   */
  async findAll(
    query:     OrderQueryDto,
    companyId?: number, // если задан — фильтр только этой компании (клиент)
  ): Promise<{ items: Order[]; total: number }> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.orders.createQueryBuilder('o')
      .orderBy('o.created_at', 'DESC');

    if (companyId) {
      qb.where('o.company_id = :companyId', { companyId });
    } else if (query.companyId) {
      qb.where('o.company_id = :companyId', { companyId: query.companyId });
    }

    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    }

    if (query.urgentOnly) {
      // Заказы у которых window_closes_at в ближайшие 48 часов
      const soon = new Date(Date.now() + 48 * 3600 * 1000);
      qb.andWhere('o.window_closes_at IS NOT NULL')
        .andWhere('o.window_closes_at <= :soon', { soon })
        .andWhere('o.status = :building', { building: OrderStatus.BUILDING });
    }

    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();

    return { items, total };
  }

  /**
   * Один заказ — проверка владельца для клиентов.
   */
  async findOne(id: number, companyId?: number): Promise<Order> {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Заказ #${id} не найден`);
    if (companyId && order.companyId !== companyId) {
      throw new ForbiddenException('Нет доступа к этому заказу');
    }
    return order;
  }

  /**
   * Обновить заметки / количество фур (до locked).
   */
  async update(id: number, companyId: number, dto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id, companyId);
    if (!order.isEditable) {
      throw new ForbiddenException('Заказ нельзя редактировать в текущем статусе');
    }
    if (dto.truckCount !== undefined) order.truckCount = dto.truckCount;
    if (dto.notes      !== undefined) order.notes      = dto.notes;
    return this.orders.save(order);
  }

  /**
   * История статусов — для таймлайна согласования в TMA.
   */
  getHistory(orderId: number): Promise<OrderStatusHistory[]> {
    return this.history.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // СТАТУСНАЯ МАШИНА — переходы
  // ══════════════════════════════════════════════════════════════════════

  /**
   * [Клиент] Предложить дату погрузки.
   * draft → negotiating  или  negotiating (повторное предложение)
   */
  async proposeDate(
    id:        number,
    companyId: number,
    actorId:   number,
    dto:       ProposeDateDto,
  ): Promise<Order> {
    const order = await this.findOne(id, companyId);

    if (![OrderStatus.DRAFT, OrderStatus.NEGOTIATING].includes(order.status)) {
      throw new BadRequestException(
        `Нельзя предложить дату в статусе "${order.status}"`,
      );
    }

    this.validateFutureDate(dto.proposedDate);

    const prev = order.status;
    order.proposedDate = dto.proposedDate;
    order.proposedBy   = actorId;
    order.status       = OrderStatus.NEGOTIATING;

    await this.orders.save(order);
    await this.writeHistory(
      order.id, prev, OrderStatus.NEGOTIATING,
      actorId, 'client',
      `Клиент предложил дату: ${dto.proposedDate}`,
    );

    this.logger.log(`Order #${id}: proposed date ${dto.proposedDate}`);
    return order;
  }

  /**
   * [Менеджер] Подтвердить дату погрузки.
   * negotiating → confirmed
   * Автоматически вычисляет windowOpensAt / windowClosesAt.
   */
  async confirmDate(
    id:      number,
    actorId: number,
    dto:     ConfirmDateDto,
  ): Promise<Order> {
    const order = await this.findOne(id);
    this.assertTransition(order, OrderStatus.CONFIRMED);
    this.validateFutureDate(dto.confirmedDate);

    order.confirmedDate = dto.confirmedDate;
    order.confirmedBy   = actorId;
    order.status        = OrderStatus.CONFIRMED;
    if (dto.truckCount) order.truckCount = dto.truckCount;

    // Вычисляем окно редактирования паллет
    const { opens, closes } = this.calcPalletWindow(dto.confirmedDate);
    order.windowOpensAt  = opens;
    order.windowClosesAt = closes;

    await this.orders.save(order);
    await this.writeHistory(
      order.id, OrderStatus.NEGOTIATING, OrderStatus.CONFIRMED,
      actorId, 'manager',
      dto.comment ?? `Дата подтверждена: ${dto.confirmedDate}`,
    );

    this.logger.log(
      `Order #${id}: confirmed ${dto.confirmedDate}, ` +
      `window ${opens.toISOString()} – ${closes.toISOString()}`,
    );
    return order;
  }

  /**
   * [Cron] Открыть окно паллет — confirmed → building.
   * Вызывается автоматически за WINDOW_DAYS_BEFORE дней до погрузки.
   */
  async openPalletWindow(id: number): Promise<Order> {
    const order = await this.findOne(id);
    this.assertTransition(order, OrderStatus.BUILDING);

    order.status = OrderStatus.BUILDING;
    await this.orders.save(order);
    await this.writeHistory(
      order.id, OrderStatus.CONFIRMED, OrderStatus.BUILDING,
      null, 'system',
      'Окно паллет открыто автоматически',
    );

    this.logger.log(`Order #${id}: pallet window OPENED (building)`);
    return order;
  }

  /**
   * [Клиент] Подтвердить план паллет.
   * building → locked
   * Проверяет что все паллеты назначены в фуры — логику делегируем в PalletsService,
   * здесь только переход статуса.
   */
  async confirmPlan(
    id:        number,
    companyId: number,
    actorId:   number,
    dto:       ConfirmPlanDto,
  ): Promise<Order> {
    const order = await this.findOne(id, companyId);
    this.assertTransition(order, OrderStatus.LOCKED);

    if (!order.isPalletWindowOpen) {
      throw new BadRequestException('Окно паллет закрыто — нельзя подтвердить план');
    }

    order.status   = OrderStatus.LOCKED;
    order.lockedBy = actorId;

    await this.orders.save(order);
    await this.writeHistory(
      order.id, OrderStatus.BUILDING, OrderStatus.LOCKED,
      actorId, 'client',
      dto.comment ?? 'Клиент подтвердил план загрузки',
    );

    this.logger.log(`Order #${id}: plan LOCKED by client ${actorId}`);
    return order;
  }

  /**
   * [Cron] Автоматическая блокировка при истечении дедлайна.
   * building → locked (если клиент не успел сам)
   */
  async autoLock(id: number): Promise<Order> {
    const order = await this.findOne(id);

    if (order.status !== OrderStatus.BUILDING) return order;

    order.status = OrderStatus.LOCKED;
    await this.orders.save(order);
    await this.writeHistory(
      order.id, OrderStatus.BUILDING, OrderStatus.LOCKED,
      null, 'system',
      'Авто-блокировка: дедлайн окна паллет истёк',
    );

    this.logger.warn(`Order #${id}: AUTO-LOCKED (deadline passed)`);
    return order;
  }

  /**
   * [Менеджер] Отметить отгрузку.
   * locked → shipped
   */
  async ship(id: number, actorId: number, dto: ShipOrderDto): Promise<Order> {
    const order = await this.findOne(id);
    this.assertTransition(order, OrderStatus.SHIPPED);

    order.status    = OrderStatus.SHIPPED;
    order.shippedBy = actorId;
    order.shippedAt = new Date();

    await this.orders.save(order);
    await this.writeHistory(
      order.id, OrderStatus.LOCKED, OrderStatus.SHIPPED,
      actorId, 'manager',
      dto.comment ?? 'Отгрузка выполнена',
    );

    this.logger.log(`Order #${id}: SHIPPED by manager ${actorId}`);
    return order;
  }

  /**
   * [Менеджер/Admin] Отменить заказ.
   * Любой статус кроме shipped → cancelled
   */
  async cancel(id: number, actorId: number, dto: CancelOrderDto): Promise<Order> {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.SHIPPED) {
      throw new ForbiddenException('Нельзя отменить отгруженный заказ');
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Заказ уже отменён');
    }

    const prev = order.status;
    order.status = OrderStatus.CANCELLED;

    await this.orders.save(order);
    await this.writeHistory(
      order.id, prev, OrderStatus.CANCELLED,
      actorId, 'manager',
      dto.reason ?? 'Отменён менеджером',
    );

    this.logger.log(`Order #${id}: CANCELLED (was ${prev}), reason: ${dto.reason}`);
    return order;
  }

  // ══════════════════════════════════════════════════════════════════════
  // CRON-ЗАДАЧИ
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Найти заказы у которых сегодня нужно открыть окно паллет.
   * Вызывается Cron каждый день в 09:00 UTC.
   */
  async findOrdersToOpenWindow(today: Date): Promise<Order[]> {
    const targetDate = this.addDays(today, WINDOW_DAYS_BEFORE);
    const dateStr    = this.toDateStr(targetDate);

    return this.orders.find({
      where: {
        confirmedDate: dateStr,
        status:        OrderStatus.CONFIRMED,
      },
    });
  }

  /**
   * Найти заказы с истёкшим дедлайном паллет.
   * building + windowClosesAt < now
   */
  async findExpiredWindows(): Promise<Order[]> {
    return this.orders
      .createQueryBuilder('o')
      .where('o.status = :status', { status: OrderStatus.BUILDING })
      .andWhere('o.window_closes_at < :now', { now: new Date() })
      .getMany();
  }

  /**
   * Найти заказы для напоминаний (за 2 дня и за 1 день до дедлайна).
   */
  async findOrdersForReminder(daysBeforeDeadline: number): Promise<Order[]> {
    const target = new Date();
    target.setDate(target.getDate() + daysBeforeDeadline);
    target.setHours(23, 59, 59, 999);

    const dayStart = new Date(target);
    dayStart.setHours(0, 0, 0, 0);

    return this.orders
      .createQueryBuilder('o')
      .where('o.status = :status', { status: OrderStatus.BUILDING })
      .andWhere('o.window_closes_at BETWEEN :start AND :end', {
        start: dayStart,
        end:   target,
      })
      .getMany();
  }

  /**
   * Агрегаты для дашборда менеджера.
   */
  async getDashboardStats(companyId?: number): Promise<{
    activeOrders:   number;
    needAction:     number;
    pendingDates:   number;
    shippedThisMonth: number;
  }> {
    const qb = this.orders.createQueryBuilder('o');
    if (companyId) qb.where('o.company_id = :companyId', { companyId });

    const [active, needAction, pendingDates, shippedThisMonth] = await Promise.all([
      qb.clone()
        .andWhere('o.status NOT IN (:...fin)', {
          fin: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
        })
        .getCount(),
      qb.clone()
        .andWhere('o.status = :s', { s: OrderStatus.BUILDING })
        .getCount(),
      qb.clone()
        .andWhere('o.status = :s', { s: OrderStatus.NEGOTIATING })
        .getCount(),
      qb.clone()
        .andWhere('o.status = :s', { s: OrderStatus.SHIPPED })
        .andWhere('o.shipped_at >= :monthStart', {
          monthStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        })
        .getCount(),
    ]);

    return { activeOrders: active, needAction, pendingDates, shippedThisMonth };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════

  private assertTransition(order: Order, next: OrderStatus): void {
    if (!order.canTransitionTo(next)) {
      throw new BadRequestException(
        `Переход "${order.status}" → "${next}" недопустим. ` +
        `Доступные переходы: [${ALLOWED_TRANSITIONS[order.status]?.join(', ') ?? 'нет'}]`,
      );
    }
  }

  private validateFutureDate(dateStr: string): void {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      throw new BadRequestException(`Дата ${dateStr} уже прошла`);
    }
  }

  /**
   * Вычислить границы окна паллет.
   * Открывается: за WINDOW_DAYS_BEFORE дней до погрузки в 00:00
   * Закрывается: за 1 день до погрузки в 23:59 (по UTC)
   */
  private calcPalletWindow(confirmedDate: string): { opens: Date; closes: Date } {
    const loading = new Date(confirmedDate);
    loading.setUTCHours(0, 0, 0, 0);

    const opens = new Date(loading);
    opens.setUTCDate(opens.getUTCDate() - WINDOW_DAYS_BEFORE);

    const closes = new Date(loading);
    closes.setUTCDate(closes.getUTCDate() - 1);
    closes.setUTCHours(WINDOW_CLOSE_HOUR, WINDOW_CLOSE_MIN, 59, 999);

    return { opens, closes };
  }

  private async writeHistory(
    orderId:    number,
    from:       OrderStatus | null,
    to:         OrderStatus,
    actorId:    number | null,
    actorRole:  string,
    comment?:   string,
  ): Promise<void> {
    await this.history.save(
      this.history.create({
        orderId,
        fromStatus: from,
        toStatus:   to,
        actorId:    actorId ?? null,
        actorRole,
        comment:    comment ?? null,
      }),
    );
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private toDateStr(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }
}
