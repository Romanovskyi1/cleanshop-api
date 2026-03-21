import { Repository } from 'typeorm';
import { Product, ProductCategory } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto, ProductQueryDto, ProductListItemDto, PaginatedProductsDto } from './dto/product.dto';
export declare class ProductsService {
    private readonly repo;
    private readonly logger;
    constructor(repo: Repository<Product>);
    findAll(query: ProductQueryDto): Promise<PaginatedProductsDto>;
    findOne(id: number, lang?: string): Promise<ProductListItemDto & {
        description: string;
        palletsPerTruck: number;
        palletPriceEur: number;
        palletWeightKg: number;
    }>;
    findBySku(sku: string): Promise<Product>;
    getPalletData(productId: number): Promise<{
        priceEur: number;
        unitsPerBox: number;
        boxesPerPallet: number;
        boxWeightKg: number;
    }>;
    getCategories(): Promise<Array<{
        category: ProductCategory;
        count: number;
    }>>;
    adminCreate(dto: CreateProductDto): Promise<Product>;
    adminUpdate(id: number, dto: UpdateProductDto): Promise<Product>;
    updateStock(id: number, stockPallets: number): Promise<void>;
    adminRemove(id: number): Promise<void>;
    private applySorting;
    private toListItem;
    private localise;
}
