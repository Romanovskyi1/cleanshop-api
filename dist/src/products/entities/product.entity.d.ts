export declare enum ProductCategory {
    GEL = "gel",
    POWDER = "powder",
    CONCENTRATE = "concentrate",
    TABLET = "tablet",
    SPRAY = "spray"
}
export interface I18nString {
    ru?: string;
    en?: string;
    de?: string;
    pl?: string;
}
export declare class Product {
    id: number;
    sku: string;
    name: I18nString;
    description: I18nString;
    category: ProductCategory;
    volumeL: number;
    weightKg: number;
    priceEur: number;
    unitsPerBox: number;
    boxesPerPallet: number;
    palletsPerTruck: number;
    palletWeightKg: number;
    boxWeightKg: number;
    stockPallets: number;
    isEco: boolean;
    certifications: string[];
    images: string[];
    isActive: boolean;
    isNew: boolean;
    isHit: boolean;
    createdAt: Date;
    updatedAt: Date;
    get boxPriceEur(): number;
    get palletPriceEur(): number;
    get computedBoxWeightKg(): number;
    get stockStatus(): 'ok' | 'low' | 'out';
    getLocaleName(lang?: string): string;
}
