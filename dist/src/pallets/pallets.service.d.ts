import { Repository, DataSource } from 'typeorm';
import { Pallet, PalletItem } from './entities/pallet.entity';
import { Truck } from '../orders/entities/truck.entity';
import { Order } from '../orders/entities/order.entity';
import { CreatePalletDto, UpdatePalletDto, AddPalletItemDto, UpdatePalletItemDto, AssignPalletsToTruckDto, PalletQueryDto } from './dto/pallet.dto';
export declare class PalletsService {
    private readonly pallets;
    private readonly items;
    private readonly trucks;
    private readonly orders;
    private readonly ds;
    private readonly logger;
    constructor(pallets: Repository<Pallet>, items: Repository<PalletItem>, trucks: Repository<Truck>, orders: Repository<Order>, ds: DataSource);
    findAll(companyId: number, query: PalletQueryDto): Promise<Pallet[]>;
    findOne(id: number, companyId: number): Promise<Pallet>;
    create(companyId: number, dto: CreatePalletDto): Promise<Pallet>;
    update(id: number, companyId: number, dto: UpdatePalletDto): Promise<Pallet>;
    remove(id: number, companyId: number): Promise<void>;
    addItem(palletId: number, companyId: number, dto: AddPalletItemDto, productData: {
        priceEur: number;
        unitsPerBox: number;
        weightPerBoxKg?: number;
    }): Promise<PalletItem>;
    findItemById(itemId: number, palletId: number): Promise<PalletItem>;
    updateItem(palletId: number, itemId: number, companyId: number, dto: UpdatePalletItemDto, productData: {
        priceEur: number;
        unitsPerBox: number;
        weightPerBoxKg?: number;
    }): Promise<PalletItem>;
    removeItem(palletId: number, itemId: number, companyId: number): Promise<void>;
    assignPalletsToTruck(truckId: number, orderId: number, companyId: number, dto: AssignPalletsToTruckDto): Promise<{
        truck: Truck;
        pallets: Pallet[];
    }>;
    removePalletFromTruck(palletId: number, companyId: number): Promise<Pallet>;
    getTrucksSummary(orderId: number, companyId: number): Promise<Array<{
        truck: Truck;
        pallets: Pallet[];
        palletCount: number;
        totalWeightKg: number;
        palletFillPct: number;
        weightFillPct: number;
    }>>;
    getUnassigned(orderId: number, companyId: number): Promise<Pallet[]>;
    lockAll(orderId: number, companyId: number): Promise<{
        locked: number;
        autoAssigned: number;
    }>;
    private recalcPallet;
    private autoDistribute;
    private assertEditable;
    private assignToTruck;
}
