import {
  IsString, IsOptional, IsEnum, IsBoolean, IsInt,
  IsPositive, IsNumber, IsArray, Min, Max,
  ValidateNested, IsObject,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ProductCategory, I18nString } from '../entities/product.entity';

// ── Создать продукт (admin) ──────────────────────────────────────────────────
export class CreateProductDto {
  @IsString()
  sku: string;

  @IsObject()
  name: I18nString;

  @IsOptional()
  @IsObject()
  description?: I18nString;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeL?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsNumber()
  @Min(0.01)
  priceEur: number;

  @IsInt()
  @Min(1)
  unitsPerBox: number;

  @IsInt()
  @Min(1)
  boxesPerPallet: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  palletsPerTruck?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  palletWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  boxWeightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockPallets?: number;

  @IsOptional()
  @IsBoolean()
  isEco?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsBoolean()
  isHit?: boolean;
}

// ── Обновить продукт (admin) ─────────────────────────────────────────────────
export class UpdateProductDto {
  @IsOptional() @IsObject()        name?:            I18nString;
  @IsOptional() @IsObject()        description?:     I18nString;
  @IsOptional() @IsNumber() @Min(0.01) priceEur?:   number;
  @IsOptional() @IsInt()   @Min(0) stockPallets?:   number;
  @IsOptional() @IsBoolean()       isEco?:           boolean;
  @IsOptional() @IsBoolean()       isActive?:        boolean;
  @IsOptional() @IsBoolean()       isNew?:           boolean;
  @IsOptional() @IsBoolean()       isHit?:           boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) certifications?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) images?:         string[];
}

// ── Query-параметры для GET /catalog ────────────────────────────────────────
export class ProductQueryDto {
  /** Поиск по названию (I18n) или SKU */
  @IsOptional()
  @IsString()
  search?: string;

  /** Фильтр по категории */
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  /** Только ЭКО-товары */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isEco?: boolean;

  /** Только в наличии */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  inStock?: boolean;

  /** Только хиты */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isHit?: boolean;

  /** Только новинки */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isNew?: boolean;

  /** Сортировка */
  @IsOptional()
  @IsEnum(['popularity', 'price_asc', 'price_desc', 'name_asc', 'stock'])
  sort?: 'popularity' | 'price_asc' | 'price_desc' | 'name_asc' | 'stock';

  /** Язык для локализации названий в ответе */
  @IsOptional()
  @IsString()
  lang?: string;

  /** Пагинация */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ── Ответ: список продуктов ──────────────────────────────────────────────────
export class ProductListItemDto {
  id:             number;
  sku:            string;
  name:           string;   // локализованное
  description:    string;   // локализованное
  category:       ProductCategory;
  volumeL:        number;
  priceEur:       number;
  boxPriceEur:    number;
  palletPriceEur: number;
  unitsPerBox:    number;
  boxesPerPallet: number;
  boxWeightKg:    number;
  stockPallets:   number;
  stockStatus:    'ok' | 'low' | 'out';
  isEco:          boolean;
  isNew:          boolean;
  isHit:          boolean;
  certifications: string[];
  images:         string[];
}

export class PaginatedProductsDto {
  items:      ProductListItemDto[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}
