import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './dto/product.dto';
import { User } from '../users/user.entity';
export declare class ProductsController {
    private readonly service;
    constructor(service: ProductsService);
    findAll(query: ProductQueryDto, user?: User): Promise<import("./dto/product.dto").PaginatedProductsDto>;
    getCategories(): Promise<{
        category: import("./entities/product.entity").ProductCategory;
        count: number;
    }[]>;
    findOne(id: number, lang: string, user?: User): Promise<import("./dto/product.dto").ProductListItemDto & {
        description: string;
        palletsPerTruck: number;
        palletPriceEur: number;
        palletWeightKg: number;
    }>;
    getPalletData(id: number): Promise<{
        priceEur: number;
        unitsPerBox: number;
        boxesPerPallet: number;
        boxWeightKg: number;
    }>;
    create(dto: CreateProductDto): Promise<import("./entities/product.entity").Product>;
    update(id: number, dto: UpdateProductDto): Promise<import("./entities/product.entity").Product>;
    updateStock(id: number, stockPallets: number): Promise<void>;
    remove(id: number): Promise<void>;
    uploadImages(id: number, files: Express.Multer.File[]): Promise<import("./entities/product.entity").Product>;
}
