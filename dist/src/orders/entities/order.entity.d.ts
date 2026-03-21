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
    proposedBy: number | null;
    confirmedBy: number | null;
    lockedBy: number | null;
    shippedBy: number | null;
    totalPallets: number;
    totalWeightKg: number | null;
    totalAmountEur: number | null;
    truckCount: number;
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
