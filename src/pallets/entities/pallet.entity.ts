import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

export enum PalletStatus {
  BUILDING  = 'building',
  READY     = 'ready',
  ASSIGNED  = 'assigned',
  LOCKED    = 'locked',
}

/**
 * Моно-паллета: одна запись = N физических паллет ОДНОГО SKU.
 * Никаких pallet_items. Агрегаты вычисляются из product × palletsCount.
 */
@Entity('pallets')
@Index(['companyId', 'orderId'])
export class Pallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'order_id', nullable: true })
  orderId: number | null;

  @Column({ name: 'truck_id', nullable: true })
  truckId: number | null;

  @Column({ nullable: false, length: 100, default: '' })
  name: string;

  @Column({ name: 'product_id' })
  productId: number;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'pallets_count', type: 'int', default: 1 })
  palletsCount: number;

  @Column({ name: 'is_legacy', type: 'boolean', default: false })
  isLegacy: boolean;

  @Column({ name: 'idempotency_key', type: 'uuid', nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'enum', enum: PalletStatus, default: PalletStatus.BUILDING })
  status: PalletStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── Computed ─────────────────────────────────────────────────────────
  get isEditable(): boolean {
    return this.status === PalletStatus.BUILDING || this.status === PalletStatus.READY;
  }

  get totalBoxes(): number {
    return this.palletsCount * (this.product?.boxesPerPallet ?? 0);
  }

  get totalWeightKg(): number {
    return this.palletsCount * Number(this.product?.palletWeightKg ?? 0);
  }

  get totalAmountEur(): number {
    const price = Number(this.product?.priceEur ?? 0);
    const boxes = this.product?.boxesPerPallet ?? 0;
    const units = this.product?.unitsPerBox ?? 1;
    // цена паллеты = price × units_per_box × boxes_per_pallet (см. Product.palletPriceEur)
    return Number((this.palletsCount * price * units * boxes).toFixed(2));
  }
}
