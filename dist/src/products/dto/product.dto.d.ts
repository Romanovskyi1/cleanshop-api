import { ProductCategory, I18nString } from '../entities/product.entity';
export declare class CreateProductDto {
    sku: string;
    name: I18nString;
    description?: I18nString;
    category: ProductCategory;
    volumeL?: number;
    weightKg?: number;
    priceEur: number;
    unitsPerBox: number;
    boxesPerPallet: number;
    palletsPerTruck?: number;
    palletWeightKg?: number;
    boxWeightKg?: number;
    stockPallets?: number;
    isEco?: boolean;
    certifications?: string[];
    images?: string[];
    isNew?: boolean;
    isHit?: boolean;
}
export declare class UpdateProductDto {
    name?: I18nString;
    description?: I18nString;
    priceEur?: number;
    stockPallets?: number;
    isEco?: boolean;
    isActive?: boolean;
    isNew?: boolean;
    isHit?: boolean;
    certifications?: string[];
    images?: string[];
}
export declare class ProductQueryDto {
    search?: string;
    category?: ProductCategory;
    isEco?: boolean;
    inStock?: boolean;
    isHit?: boolean;
    isNew?: boolean;
    sort?: 'popularity' | 'price_asc' | 'price_desc' | 'name_asc' | 'stock';
    lang?: string;
    page?: number;
    limit?: number;
}
export declare class ProductListItemDto {
    id: number;
    sku: string;
    name: string;
    description: string;
    category: ProductCategory;
    volumeL: number;
    priceEur: number;
    boxPriceEur: number;
    palletPriceEur: number;
    unitsPerBox: number;
    boxesPerPallet: number;
    boxWeightKg: number;
    stockPallets: number;
    stockStatus: 'ok' | 'low' | 'out';
    isEco: boolean;
    isNew: boolean;
    isHit: boolean;
    certifications: string[];
    images: string[];
}
export declare class PaginatedProductsDto {
    items: ProductListItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
