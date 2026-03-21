export declare enum PalletStatus {
    BUILDING = "building",
    READY = "ready",
    ASSIGNED = "assigned",
    LOCKED = "locked"
}
export declare class Pallet {
    id: number;
    companyId: number;
    orderId: number | null;
    truckId: number | null;
    name: string;
    totalBoxes: number;
    totalWeightKg: number;
    totalAmountEur: number;
    status: PalletStatus;
    items: PalletItem[];
    createdAt: Date;
    updatedAt: Date;
    get isEditable(): boolean;
    get fillPercent(): number;
}
export declare class PalletItem {
    id: number;
    palletId: number;
    pallet: Pallet;
    productId: number;
    priceEur: number;
    boxes: number;
    subtotalEur: number;
    createdAt: Date;
    updatedAt: Date;
}
