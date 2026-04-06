import { Repository } from 'typeorm';
import { PalletsService } from './pallets.service';
import { CreatePalletDto, UpdatePalletDto, AddPalletItemDto, UpdatePalletItemDto, AssignPalletsToTruckDto, PalletQueryDto } from './dto/pallet.dto';
import { User } from '../users/user.entity';
import { Product } from '../products/entities/product.entity';
export declare class PalletsController {
    private readonly service;
    private readonly products;
    constructor(service: PalletsService, products: Repository<Product>);
    findAll(user: User, query: PalletQueryDto): Promise<import("./entities/pallet.entity").Pallet[]>;
    findOne(id: number, user: User): Promise<import("./entities/pallet.entity").Pallet>;
    create(user: User, dto: CreatePalletDto): Promise<import("./entities/pallet.entity").Pallet>;
    update(id: number, user: User, dto: UpdatePalletDto): Promise<import("./entities/pallet.entity").Pallet>;
    remove(id: number, user: User): Promise<void>;
    addItem(palletId: number, user: User, dto: AddPalletItemDto): Promise<import("./entities/pallet.entity").PalletItem>;
    updateItem(palletId: number, itemId: number, user: User, dto: UpdatePalletItemDto): Promise<import("./entities/pallet.entity").PalletItem>;
    removeItem(palletId: number, itemId: number, user: User): Promise<void>;
    trucksSummary(orderId: number, user: User): Promise<{
        truck: import("../orders/entities/truck.entity").Truck;
        pallets: import("./entities/pallet.entity").Pallet[];
        palletCount: number;
        totalWeightKg: number;
        palletFillPct: number;
        weightFillPct: number;
    }[]>;
    unassigned(orderId: number, user: User): Promise<import("./entities/pallet.entity").Pallet[]>;
    assignToTruck(orderId: number, truckId: number, user: User, dto: AssignPalletsToTruckDto): Promise<{
        truck: import("../orders/entities/truck.entity").Truck;
        pallets: import("./entities/pallet.entity").Pallet[];
    }>;
    removeFromTruck(palletId: number, user: User): Promise<import("./entities/pallet.entity").Pallet>;
}
