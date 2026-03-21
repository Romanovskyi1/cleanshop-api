import { OrdersService } from './orders.service';
import { CreateOrderDto, ProposeDateDto, ConfirmDateDto, ConfirmPlanDto, CancelOrderDto, ShipOrderDto, UpdateOrderDto, OrderQueryDto } from './dto/order.dto';
import { User } from '../users/user.entity';
export declare class OrdersController {
    private readonly service;
    constructor(service: OrdersService);
    findAll(user: User, query: OrderQueryDto): Promise<{
        items: import("./entities/order.entity").Order[];
        total: number;
    }>;
    getStats(user: User): Promise<{
        activeOrders: number;
        needAction: number;
        pendingDates: number;
        shippedThisMonth: number;
    }>;
    findOne(id: number, user: User): Promise<import("./entities/order.entity").Order>;
    getHistory(id: number): Promise<import("./entities/order-status-history.entity").OrderStatusHistory[]>;
    create(user: User, dto: CreateOrderDto): Promise<import("./entities/order.entity").Order>;
    update(id: number, user: User, dto: UpdateOrderDto): Promise<import("./entities/order.entity").Order>;
    proposeDate(id: number, user: User, dto: ProposeDateDto): Promise<import("./entities/order.entity").Order>;
    confirmDate(id: number, manager: User, dto: ConfirmDateDto): Promise<import("./entities/order.entity").Order>;
    confirmPlan(id: number, user: User, dto: ConfirmPlanDto): Promise<import("./entities/order.entity").Order>;
    ship(id: number, manager: User, dto: ShipOrderDto): Promise<import("./entities/order.entity").Order>;
    cancel(id: number, manager: User, dto: CancelOrderDto): Promise<import("./entities/order.entity").Order>;
}
