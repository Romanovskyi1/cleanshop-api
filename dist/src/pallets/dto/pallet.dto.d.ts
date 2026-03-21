import { PalletStatus } from '../entities/pallet.entity';
export declare class CreatePalletDto {
    name?: string;
    orderId?: number;
}
export declare class UpdatePalletDto {
    name?: string;
    truckId?: number | null;
}
export declare class AddPalletItemDto {
    productId: number;
    boxes: number;
}
export declare class UpdatePalletItemDto {
    boxes: number;
}
export declare class AssignPalletsToTruckDto {
    palletIds: number[];
}
export declare class PalletQueryDto {
    orderId?: number;
    status?: PalletStatus;
}
