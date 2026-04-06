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
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const order_entity_1 = require("./entities/order.entity");
const order_status_history_entity_1 = require("./entities/order-status-history.entity");
const WINDOW_DAYS_BEFORE = 5;
const WINDOW_CLOSE_HOUR = 23;
const WINDOW_CLOSE_MIN = 59;
let OrdersService = OrdersService_1 = class OrdersService {
    constructor(orders, history, ds) {
        this.orders = orders;
        this.history = history;
        this.ds = ds;
        this.logger = new common_1.Logger(OrdersService_1.name);
    }
    async create(companyId, actorId, dto) {
        let order = this.orders.create({
            companyId,
            notes: dto.notes ?? null,
            truckType: dto.truckType ?? null,
            status: order_entity_1.OrderStatus.DRAFT,
        });
        order = await this.orders.save(order);
        await this.writeHistory(order.id, null, order_entity_1.OrderStatus.DRAFT, actorId, 'client', 'Заказ создан');
        if (dto.proposedDate) {
            order = await this.proposeDate(order.id, companyId, actorId, { proposedDate: dto.proposedDate });
        }
        this.logger.log(`Order #${order.id} created for company ${companyId}`);
        return order;
    }
    async findAll(query, companyId) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const qb = this.orders.createQueryBuilder('o')
            .orderBy('o.created_at', 'DESC');
        if (companyId) {
            qb.where('o.company_id = :companyId', { companyId });
        }
        else if (query.companyId) {
            qb.where('o.company_id = :companyId', { companyId: query.companyId });
        }
        if (query.status) {
            qb.andWhere('o.status = :status', { status: query.status });
        }
        if (query.urgentOnly) {
            const soon = new Date(Date.now() + 48 * 3600 * 1000);
            qb.andWhere('o.window_closes_at IS NOT NULL')
                .andWhere('o.window_closes_at <= :soon', { soon })
                .andWhere('o.status = :building', { building: order_entity_1.OrderStatus.BUILDING });
        }
        const total = await qb.getCount();
        const items = await qb.skip((page - 1) * limit).take(limit).getMany();
        return { items, total };
    }
    async findOne(id, companyId) {
        const order = await this.orders.findOne({ where: { id } });
        if (!order)
            throw new common_1.NotFoundException(`Заказ #${id} не найден`);
        if (companyId && order.companyId !== companyId) {
            throw new common_1.ForbiddenException('Нет доступа к этому заказу');
        }
        return order;
    }
    async removeDraft(id, companyId) {
        const order = await this.findOne(id, companyId);
        if (order.status !== order_entity_1.OrderStatus.DRAFT) {
            throw new common_1.ForbiddenException('Можно удалить только черновик заказа');
        }
        await this.orders.remove(order);
        this.logger.log(`Order #${id} (draft) deleted by company ${companyId}`);
    }
    async submitDraft(id, companyId, actorId) {
        const order = await this.findOne(id, companyId);
        if (order.status !== order_entity_1.OrderStatus.DRAFT) {
            throw new common_1.BadRequestException('Можно отправить только черновик');
        }
        order.status = order_entity_1.OrderStatus.NEGOTIATING;
        order.proposedBy = actorId;
        await this.orders.save(order);
        await this.writeHistory(order.id, order_entity_1.OrderStatus.DRAFT, order_entity_1.OrderStatus.NEGOTIATING, actorId, 'client', 'Клиент отправил заказ менеджеру');
        this.logger.log(`Order #${id}: submitted (draft→negotiating) by client ${actorId}`);
        return order;
    }
    async clientCancelOrder(id, companyId, actorId) {
        const order = await this.findOne(id, companyId);
        if (order.status !== order_entity_1.OrderStatus.NEGOTIATING) {
            throw new common_1.BadRequestException('Клиент может отменить только заказ в статусе согласования');
        }
        order.status = order_entity_1.OrderStatus.CANCELLED;
        await this.orders.save(order);
        await this.writeHistory(order.id, order_entity_1.OrderStatus.NEGOTIATING, order_entity_1.OrderStatus.CANCELLED, actorId, 'client', 'Отменён клиентом');
        this.logger.log(`Order #${id}: cancelled by client ${actorId}`);
        return order;
    }
    async forceDelete(id) {
        const order = await this.orders.findOne({ where: { id } });
        if (!order)
            throw new common_1.NotFoundException(`Заказ #${id} не найден`);
        await this.orders.remove(order);
        this.logger.log(`Order #${id} force-deleted by admin`);
    }
    async update(id, companyId, dto) {
        const order = await this.findOne(id, companyId);
        if (!order.isEditable) {
            throw new common_1.ForbiddenException('Заказ нельзя редактировать в текущем статусе');
        }
        if (dto.notes !== undefined)
            order.notes = dto.notes;
        return this.orders.save(order);
    }
    getHistory(orderId) {
        return this.history.find({
            where: { orderId },
            order: { createdAt: 'ASC' },
        });
    }
    async proposeDate(id, companyId, actorId, dto) {
        const order = await this.findOne(id, companyId);
        if (![order_entity_1.OrderStatus.DRAFT, order_entity_1.OrderStatus.NEGOTIATING].includes(order.status)) {
            throw new common_1.BadRequestException(`Нельзя предложить дату в статусе "${order.status}"`);
        }
        this.validateFutureDate(dto.proposedDate);
        const prev = order.status;
        order.proposedDate = dto.proposedDate;
        order.proposedBy = actorId;
        order.status = order_entity_1.OrderStatus.NEGOTIATING;
        await this.orders.save(order);
        await this.writeHistory(order.id, prev, order_entity_1.OrderStatus.NEGOTIATING, actorId, 'client', `Клиент предложил дату: ${dto.proposedDate}`);
        this.logger.log(`Order #${id}: proposed date ${dto.proposedDate}`);
        return order;
    }
    async confirmDate(id, actorId, dto) {
        const order = await this.findOne(id);
        this.assertTransition(order, order_entity_1.OrderStatus.CONFIRMED);
        this.validateFutureDate(dto.confirmedDate);
        order.confirmedDate = dto.confirmedDate;
        order.confirmedBy = actorId;
        order.status = order_entity_1.OrderStatus.CONFIRMED;
        const { opens, closes } = this.calcPalletWindow(dto.confirmedDate);
        order.windowOpensAt = opens;
        order.windowClosesAt = closes;
        await this.orders.save(order);
        await this.writeHistory(order.id, order_entity_1.OrderStatus.NEGOTIATING, order_entity_1.OrderStatus.CONFIRMED, actorId, 'manager', dto.comment ?? `Дата подтверждена: ${dto.confirmedDate}`);
        this.logger.log(`Order #${id}: confirmed ${dto.confirmedDate}, ` +
            `window ${opens.toISOString()} – ${closes.toISOString()}`);
        return order;
    }
    async openPalletWindow(id, actorId = null) {
        const order = await this.findOne(id);
        this.assertTransition(order, order_entity_1.OrderStatus.BUILDING);
        order.status = order_entity_1.OrderStatus.BUILDING;
        if (!order.windowClosesAt && order.confirmedDate) {
            const { opens, closes } = this.calcPalletWindow(order.confirmedDate);
            order.windowOpensAt = opens;
            order.windowClosesAt = closes;
        }
        await this.orders.save(order);
        await this.writeHistory(order.id, order_entity_1.OrderStatus.CONFIRMED, order_entity_1.OrderStatus.BUILDING, actorId, actorId ? 'manager' : 'system', actorId ? 'Окно паллет открыто менеджером вручную' : 'Окно паллет открыто автоматически');
        this.logger.log(`Order #${id}: pallet window OPENED (building) by ${actorId ?? 'system'}`);
        return order;
    }
    async confirmPlan(id, companyId, actorId, dto) {
        const order = await this.findOne(id, companyId);
        this.assertTransition(order, order_entity_1.OrderStatus.LOCKED);
        if (!order.isPalletWindowOpen) {
            throw new common_1.BadRequestException('Окно паллет закрыто — нельзя подтвердить план');
        }
        order.status = order_entity_1.OrderStatus.LOCKED;
        await this.orders.save(order);
        await this.writeHistory(order.id, order_entity_1.OrderStatus.BUILDING, order_entity_1.OrderStatus.LOCKED, actorId, 'client', dto.comment ?? 'Клиент подтвердил план загрузки');
        this.logger.log(`Order #${id}: plan LOCKED by client ${actorId}`);
        return order;
    }
    async autoLock(id) {
        const order = await this.findOne(id);
        if (order.status !== order_entity_1.OrderStatus.BUILDING)
            return order;
        order.status = order_entity_1.OrderStatus.LOCKED;
        await this.orders.save(order);
        await this.writeHistory(order.id, order_entity_1.OrderStatus.BUILDING, order_entity_1.OrderStatus.LOCKED, null, 'system', 'Авто-блокировка: дедлайн окна паллет истёк');
        this.logger.warn(`Order #${id}: AUTO-LOCKED (deadline passed)`);
        return order;
    }
    async ship(id, actorId, dto) {
        const order = await this.findOne(id);
        this.assertTransition(order, order_entity_1.OrderStatus.SHIPPED);
        order.status = order_entity_1.OrderStatus.SHIPPED;
        order.shippedAt = new Date();
        await this.orders.save(order);
        await this.writeHistory(order.id, order_entity_1.OrderStatus.LOCKED, order_entity_1.OrderStatus.SHIPPED, actorId, 'manager', dto.comment ?? 'Отгрузка выполнена');
        this.logger.log(`Order #${id}: SHIPPED by manager ${actorId}`);
        return order;
    }
    async cancel(id, actorId, dto) {
        const order = await this.findOne(id);
        if (order.status === order_entity_1.OrderStatus.SHIPPED) {
            throw new common_1.ForbiddenException('Нельзя отменить отгруженный заказ');
        }
        if (order.status === order_entity_1.OrderStatus.CANCELLED) {
            throw new common_1.BadRequestException('Заказ уже отменён');
        }
        const prev = order.status;
        order.status = order_entity_1.OrderStatus.CANCELLED;
        await this.orders.save(order);
        await this.writeHistory(order.id, prev, order_entity_1.OrderStatus.CANCELLED, actorId, 'manager', dto.reason ?? 'Отменён менеджером');
        this.logger.log(`Order #${id}: CANCELLED (was ${prev}), reason: ${dto.reason}`);
        return order;
    }
    async findOrdersToOpenWindow(today) {
        const targetDate = this.addDays(today, WINDOW_DAYS_BEFORE);
        const dateStr = this.toDateStr(targetDate);
        return this.orders.find({
            where: {
                confirmedDate: dateStr,
                status: order_entity_1.OrderStatus.CONFIRMED,
            },
        });
    }
    async findExpiredWindows() {
        return this.orders
            .createQueryBuilder('o')
            .where('o.status = :status', { status: order_entity_1.OrderStatus.BUILDING })
            .andWhere('o.pallet_deadline < :now', { now: new Date() })
            .getMany();
    }
    async findOrdersForReminder(daysBeforeDeadline) {
        const target = new Date();
        target.setDate(target.getDate() + daysBeforeDeadline);
        target.setHours(23, 59, 59, 999);
        const dayStart = new Date(target);
        dayStart.setHours(0, 0, 0, 0);
        return this.orders
            .createQueryBuilder('o')
            .where('o.status = :status', { status: order_entity_1.OrderStatus.BUILDING })
            .andWhere('o.pallet_deadline BETWEEN :start AND :end', {
            start: dayStart,
            end: target,
        })
            .getMany();
    }
    async getDashboardStats(companyId) {
        const qb = this.orders.createQueryBuilder('o');
        if (companyId)
            qb.where('o.company_id = :companyId', { companyId });
        const [active, needAction, pendingDates, shippedThisMonth] = await Promise.all([
            qb.clone()
                .andWhere('o.status NOT IN (:...fin)', {
                fin: [order_entity_1.OrderStatus.SHIPPED, order_entity_1.OrderStatus.CANCELLED],
            })
                .getCount(),
            qb.clone()
                .andWhere('o.status = :s', { s: order_entity_1.OrderStatus.BUILDING })
                .getCount(),
            qb.clone()
                .andWhere('o.status = :s', { s: order_entity_1.OrderStatus.NEGOTIATING })
                .getCount(),
            qb.clone()
                .andWhere('o.status = :s', { s: order_entity_1.OrderStatus.SHIPPED })
                .andWhere('o.shipped_at >= :monthStart', {
                monthStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            })
                .getCount(),
        ]);
        return { activeOrders: active, needAction, pendingDates, shippedThisMonth };
    }
    assertTransition(order, next) {
        if (!order.canTransitionTo(next)) {
            throw new common_1.BadRequestException(`Переход "${order.status}" → "${next}" недопустим. ` +
                `Доступные переходы: [${order_entity_1.ALLOWED_TRANSITIONS[order.status]?.join(', ') ?? 'нет'}]`);
        }
    }
    validateFutureDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) {
            throw new common_1.BadRequestException(`Дата ${dateStr} уже прошла`);
        }
    }
    calcPalletWindow(confirmedDate) {
        const loading = new Date(confirmedDate);
        loading.setUTCHours(0, 0, 0, 0);
        const opens = new Date(loading);
        opens.setUTCDate(opens.getUTCDate() - WINDOW_DAYS_BEFORE);
        const closes = new Date(loading);
        closes.setUTCDate(closes.getUTCDate() - 1);
        closes.setUTCHours(WINDOW_CLOSE_HOUR, WINDOW_CLOSE_MIN, 59, 999);
        return { opens, closes };
    }
    async writeHistory(orderId, from, to, actorId, actorRole, comment) {
        await this.history.save(this.history.create({
            orderId,
            fromStatus: from,
            toStatus: to,
            actorId: actorId ?? null,
            actorRole,
            comment: comment ?? null,
        }));
    }
    addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }
    toDateStr(date) {
        return date.toISOString().slice(0, 10);
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(order_entity_1.Order)),
    __param(1, (0, typeorm_1.InjectRepository)(order_status_history_entity_1.OrderStatusHistory)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], OrdersService);
//# sourceMappingURL=orders.service.js.map