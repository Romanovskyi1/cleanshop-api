export declare enum TruckType {
    SMALL_5T = "small_5t",
    LARGE_24T = "large_24t"
}
export declare enum OrderStatus {
    DRAFT = "draft",
    NEGOTIATING = "negotiating",
    CONFIRMED = "confirmed",
    BUILDING = "building",
    LOCKED = "locked",
    SHIPPED = "shipped",
    CANCELLED = "cancelled"
}
export declare const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]>;
export declare class Order {
    id: number;
    companyId: number;
    proposedDate: string | null;
    confirmedDate: string | null;
    status: OrderStatus;
    truckType: TruckType | null;
    proposedBy: number | null;
    confirmedBy: number | null;
    totalPallets: number;
    totalWeightKg: number | null;
    totalAmountEur: number | null;
    notes: string | null;
    windowOpensAt: Date | null;
    windowClosesAt: Date | null;
    shippedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    get isPalletWindowOpen(): boolean;
    get isEditable(): boolean;
    canTransitionTo(next: OrderStatus): boolean;
}
