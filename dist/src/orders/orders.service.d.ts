import { Repository, DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { CreateOrderDto, ProposeDateDto, ConfirmDateDto, ConfirmPlanDto, CancelOrderDto, ShipOrderDto, UpdateOrderDto, OrderQueryDto } from './dto/order.dto';
export declare class OrdersService {
    private readonly orders;
    private readonly history;
    private readonly ds;
    private readonly logger;
    constructor(orders: Repository<Order>, history: Repository<OrderStatusHistory>, ds: DataSource);
    create(companyId: number, actorId: number, dto: CreateOrderDto): Promise<Order>;
    findAll(query: OrderQueryDto, companyId?: number): Promise<{
        items: Order[];
        total: number;
    }>;
    findOne(id: number, companyId?: number): Promise<Order>;
    removeDraft(id: number, companyId: number): Promise<void>;
    submitDraft(id: number, companyId: number, actorId: number): Promise<Order>;
    clientCancelOrder(id: number, companyId: number, actorId: number): Promise<Order>;
    forceDelete(id: number): Promise<void>;
    update(id: number, companyId: number, dto: UpdateOrderDto): Promise<Order>;
    getHistory(orderId: number): Promise<OrderStatusHistory[]>;
    proposeDate(id: number, companyId: number, actorId: number, dto: ProposeDateDto): Promise<Order>;
    confirmDate(id: number, actorId: number, dto: ConfirmDateDto): Promise<Order>;
    openPalletWindow(id: number, actorId?: number | null): Promise<Order>;
    confirmPlan(id: number, companyId: number, actorId: number, dto: ConfirmPlanDto): Promise<Order>;
    autoLock(id: number): Promise<Order>;
    ship(id: number, actorId: number, dto: ShipOrderDto): Promise<Order>;
    cancel(id: number, actorId: number, dto: CancelOrderDto): Promise<Order>;
    findOrdersToOpenWindow(today: Date): Promise<Order[]>;
    findExpiredWindows(): Promise<Order[]>;
    findOrdersForReminder(daysBeforeDeadline: number): Promise<Order[]>;
    getDashboardStats(companyId?: number): Promise<{
        activeOrders: number;
        needAction: number;
        pendingDates: number;
        shippedThisMonth: number;
    }>;
    private assertTransition;
    private validateFutureDate;
    private calcPalletWindow;
    private writeHistory;
    private addDays;
    private toDateStr;
}
