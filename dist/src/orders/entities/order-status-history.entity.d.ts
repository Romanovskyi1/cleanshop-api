import { OrderStatus } from './order.entity';
export declare class OrderStatusHistory {
    id: number;
    orderId: number;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    actorId: number | null;
    actorRole: string | null;
    comment: string | null;
    createdAt: Date;
}
