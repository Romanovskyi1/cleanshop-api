// src/orders/entities/order.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
  OneToMany,
} from 'typeorm';

// ── Статусная машина ──────────────────────────────────────────────────────────
//
//   draft
//     │  клиент предлагает дату  (propose-date)
//     ▼
//   negotiating
//     │  менеджер подтверждает дату  (confirm-date)
//     ▼
//   confirmed
//     │  система открывает окно паллет (за 5 дней до погрузки — Cron)
//     ▼
//   building   ← клиент собирает паллеты
//     │  клиент нажимает «Подтвердить план»  (confirm-plan)
//     ▼
//   locked     ← паллеты зафиксированы, менеджер выставляет инвойс
//     │  менеджер отмечает отгрузку  (ship)
//     ▼
//   shipped
//
//   Любой статус → cancelled  (только менеджер/admin)

export enum OrderStatus {
  DRAFT       = 'draft',
  NEGOTIATING = 'negotiating',
  CONFIRMED   = 'confirmed',
  BUILDING    = 'building',
  LOCKED      = 'locked',
  SHIPPED     = 'shipped',
  CANCELLED   = 'cancelled',
}

// Допустимые переходы: status → Set<следующих статусов>
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]:       [OrderStatus.NEGOTIATING, OrderStatus.CANCELLED],
  [OrderStatus.NEGOTIATING]: [OrderStatus.CONFIRMED,   OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]:   [OrderStatus.BUILDING,    OrderStatus.CANCELLED],
  [OrderStatus.BUILDING]:    [OrderStatus.LOCKED,      OrderStatus.CANCELLED],
  [OrderStatus.LOCKED]:      [OrderStatus.SHIPPED,     OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]:     [],
  [OrderStatus.CANCELLED]:   [],
};

// ── Order entity ──────────────────────────────────────────────────────────────

@Entity('orders')
@Index(['companyId', 'status'])
@Index(['confirmedDate'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  /** Дата которую предложил клиент */
  @Column({ name: 'proposed_date', type: 'date', nullable: true })
  proposedDate: string | null;

  /** Дата подтверждённая обеими сторонами */
  @Column({ name: 'confirmed_date', type: 'date', nullable: true })
  confirmedDate: string | null;

  @Column({
    type:    'enum',
    enum:    OrderStatus,
    default: OrderStatus.DRAFT,
  })
  status: OrderStatus;

  /** Кто предложил дату */
  @Column({ name: 'proposed_by', nullable: true })
  proposedBy: number | null;

  /** Кто подтвердил дату (менеджер) */
  @Column({ name: 'confirmed_by', nullable: true })
  confirmedBy: number | null;

  /** Кто зафиксировал план паллет */
  @Column({ name: 'locked_by', nullable: true })
  lockedBy: number | null;

  /** Кто отметил отгрузку */
  @Column({ name: 'shipped_by', nullable: true })
  shippedBy: number | null;

  @Column({ name: 'total_pallets', default: 0 })
  totalPallets: number;

  @Column({
    name:      'total_weight_kg',
    type:      'decimal',
    precision: 12,
    scale:     2,
    nullable:  true,
  })
  totalWeightKg: number | null;

  @Column({
    name:      'total_amount_eur',
    type:      'decimal',
    precision: 14,
    scale:     2,
    nullable:  true,
  })
  totalAmountEur: number | null;

  /** Количество фур */
  @Column({ name: 'truck_count', default: 1 })
  truckCount: number;

  @Column({ nullable: true, length: 1000 })
  notes: string | null;

  @Column({
    name:      'window_opens_at',
    type:      'timestamptz',
    nullable:  true,
  })
  windowOpensAt: Date | null;

  @Column({
    name:      'window_closes_at',
    type:      'timestamptz',
    nullable:  true,
  })
  windowClosesAt: Date | null;

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── Computed helpers ────────────────────────────────────────────────────────

  /** Окно редактирования паллет открыто прямо сейчас */
  get isPalletWindowOpen(): boolean {
    if (!this.windowOpensAt || !this.windowClosesAt) return false;
    const now = new Date();
    return now >= this.windowOpensAt && now <= this.windowClosesAt;
  }

  /** Заказ ещё можно редактировать */
  get isEditable(): boolean {
    return ![OrderStatus.SHIPPED, OrderStatus.CANCELLED].includes(this.status);
  }

  /** Можно перейти в указанный статус */
  canTransitionTo(next: OrderStatus): boolean {
    return ALLOWED_TRANSITIONS[this.status]?.includes(next) ?? false;
  }
}
