import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum PalletStatus {
  BUILDING  = 'building',   // клиент собирает
  READY     = 'ready',      // собрана, не назначена в фуру
  ASSIGNED  = 'assigned',   // назначена в фуру
  LOCKED    = 'locked',     // окно закрыто, редактирование запрещено
}

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

  @Column({ name: 'total_boxes', default: 0 })
  totalBoxes: number;

  @Column({ name: 'total_weight_kg', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalWeightKg: number;

  @Column({ name: 'total_amount_eur', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAmountEur: number;

  @Column({ type: 'enum', enum: PalletStatus, default: PalletStatus.BUILDING })
  status: PalletStatus;

  @OneToMany(() => PalletItem, item => item.pallet, { cascade: true, eager: true })
  items: PalletItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── Computed helpers ─────────────────────────────────────────────────
  get isEditable(): boolean {
    return this.status === PalletStatus.BUILDING || this.status === PalletStatus.READY;
  }

  get fillPercent(): number {
    const maxBoxes = 40; // стандарт паллеты — переопределяется через конфиг
    return Math.round((this.totalBoxes / maxBoxes) * 100);
  }
}

// ── PalletItem ────────────────────────────────────────────────────────────────

@Entity('pallet_items')
@Index(['palletId', 'productId'], { unique: true })
export class PalletItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'pallet_id' })
  palletId: number;

  @ManyToOne(() => Pallet, pallet => pallet.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pallet_id' })
  pallet: Pallet;

  @Column({ name: 'product_id' })
  productId: number;

  // Снапшот цены на момент добавления
  @Column({ name: 'price_eur', type: 'decimal', precision: 12, scale: 2 })
  priceEur: number;

  @Column({ name: 'boxes' })
  boxes: number;

  @Column({ name: 'subtotal', type: 'decimal', precision: 14, scale: 2, insert: false, update: false })
  subtotalEur: number;

  @Column({ name: 'idempotency_key', type: 'uuid', nullable: true })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
