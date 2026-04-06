import { Order } from './order.entity';
export declare class Truck {
    id: number;
    orderId: number;
    order: Order;
    number: number;
    maxPallets: number;
    maxWeightKg: number;
    createdAt: Date;
    get displayName(): string;
}
