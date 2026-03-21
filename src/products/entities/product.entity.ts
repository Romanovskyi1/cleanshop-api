import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum ProductCategory {
  GEL         = 'gel',
  POWDER      = 'powder',
  CONCENTRATE = 'concentrate',
  TABLET      = 'tablet',
  SPRAY       = 'spray',
}

/** Мультиязычная строка — хранится как JSONB */
export interface I18nString {
  ru?: string;
  en?: string;
  de?: string;
  pl?: string;
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 50 })
  sku: string; // артикул: GC-028-5L

  /**
   * Мультиязычное название.
   * Пример: { ru: 'Гель для посуды 5L', en: 'Dish Gel 5L', de: 'Geschirrspülmittel 5L' }
   */
  @Column({ type: 'jsonb' })
  name: I18nString;

  @Column({ type: 'jsonb', nullable: true })
  description: I18nString;

  @Column({
    type: 'enum',
    enum: ProductCategory,
  })
  category: ProductCategory;

  // ── Физические параметры ────────────────────────────────────────────────
  @Column({ name: 'volume_l', type: 'decimal', precision: 10, scale: 3, nullable: true })
  volumeL: number; // объём в литрах

  @Column({ name: 'weight_kg', type: 'decimal', precision: 10, scale: 3, nullable: true })
  weightKg: number; // вес единицы товара, кг

  // ── Цена ────────────────────────────────────────────────────────────────
  @Column({ name: 'price_eur', type: 'decimal', precision: 12, scale: 2 })
  priceEur: number;

  // ── Логистические параметры ─────────────────────────────────────────────
  @Column({ name: 'units_per_box', default: 1 })
  unitsPerBox: number; // штук в коробке (кратность заказа)

  @Column({ name: 'boxes_per_pallet', default: 40 })
  boxesPerPallet: number; // коробок на паллете

  @Column({ name: 'pallets_per_truck', default: 33 })
  palletsPerTruck: number; // паллет в фуре

  @Column({ name: 'pallet_weight_kg', type: 'decimal', precision: 10, scale: 2, nullable: true })
  palletWeightKg: number; // вес полной паллеты, кг

  @Column({ name: 'box_weight_kg', type: 'decimal', precision: 10, scale: 3, nullable: true })
  boxWeightKg: number; // вес одной коробки, кг

  // ── Склад ────────────────────────────────────────────────────────────────
  @Column({ name: 'stock_pallets', default: 0 })
  stockPallets: number;

  // ── ЭКО и сертификаты ───────────────────────────────────────────────────
  @Column({ name: 'is_eco', default: false })
  isEco: boolean;

  @Column({ type: 'text', array: true, default: '{}' })
  certifications: string[]; // ['EU Ecolabel', 'Vegan', 'Phosphate-free']

  // ── Медиа ────────────────────────────────────────────────────────────────
  @Column({ type: 'text', array: true, default: '{}' })
  images: string[]; // массив URL

  // ── Флаги ────────────────────────────────────────────────────────────────
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_new', default: false })
  isNew: boolean; // бейдж «Новинка»

  @Column({ name: 'is_hit', default: false })
  isHit: boolean; // бейдж «Хит»

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── Computed helpers ─────────────────────────────────────────────────────

  /** Цена коробки */
  get boxPriceEur(): number {
    return Number((this.priceEur * this.unitsPerBox).toFixed(2));
  }

  /** Цена паллеты */
  get palletPriceEur(): number {
    return Number((this.priceEur * this.unitsPerBox * this.boxesPerPallet).toFixed(2));
  }

  /** Вес коробки в кг (fallback: вес единицы × кол-во в коробке) */
  get computedBoxWeightKg(): number {
    if (this.boxWeightKg) return Number(this.boxWeightKg);
    if (this.weightKg)    return Number((this.weightKg * this.unitsPerBox).toFixed(3));
    return 15; // дефолт если данные не заполнены
  }

  /** Статус наличия */
  get stockStatus(): 'ok' | 'low' | 'out' {
    if (this.stockPallets <= 0)  return 'out';
    if (this.stockPallets < 10)  return 'low';
    return 'ok';
  }

  /** Имя на нужном языке с fallback-цепочкой */
  getLocaleName(lang = 'en'): string {
    return (
      this.name[lang as keyof I18nString] ??
      this.name.en ??
      this.name.ru ??
      this.sku
    );
  }
}
