import { OrderStatus } from '../entities/order.entity';
export declare class CreateOrderDto {
    proposedDate?: string;
    truckCount?: number;
    notes?: string;
}
export declare class ProposeDateDto {
    proposedDate: string;
}
export declare class ConfirmDateDto {
    confirmedDate: string;
    truckCount?: number;
    comment?: string;
}
export declare class ConfirmPlanDto {
    comment?: string;
}
export declare class CancelOrderDto {
    reason?: string;
}
export declare class ShipOrderDto {
    comment?: string;
}
export declare class UpdateOrderDto {
    truckCount?: number;
    notes?: string;
}
export declare class OrderQueryDto {
    status?: OrderStatus;
    companyId?: number;
    urgentOnly?: boolean;
    page?: number;
    limit?: number;
}
