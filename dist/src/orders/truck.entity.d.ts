import { Order } from './entities/order.entity';
export declare class Truck {
    id: number;
    orderId: number;
    order: Order;
    number: number;
    maxPallets: number;
    maxWeightKg: number;
    licensePlate: string | null;
    driverName: string | null;
    createdAt: Date;
    get displayName(): string;
}
