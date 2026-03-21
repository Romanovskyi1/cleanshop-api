// src/orders/entities/truck.entity.ts
//
// ПАТЧ 1 — перемещение Truck entity в домен orders.
//
// Что меняется:
//   БЫЛО:  cleanshop-pallets/src/orders/entities/truck.entity.ts
//   СТАЛО: cleanshop-orders/src/orders/entities/truck.entity.ts  ← каноническое место
//
// После перемещения обновить импорт в PalletsModule:
//   БЫЛО:  import { Truck } from '../orders/entities/truck.entity';
//   СТАЛО: import { Truck } from '@cleanshop/orders';  // монорепо
//          или относительный путь до нового места
//
// Изменения в entity:
//   + добавлен @ManyToOne к Order (для eager join в getTrucksWithPallets)
//   + добавлен @OneToMany к Pallet (для полного состава в одном запросе)
//   + добавлены nullable поля license_plate и driver_name (реальные данные фуры)

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, Index,
} from 'typeorm';
import { Order }  from './entities/order.entity';

@Entity('trucks')
@Index(['orderId'])
export class Truck {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** Порядковый номер в погрузке: 1, 2, 3… */
  @Column()
  number: number;

  @Column({ name: 'max_pallets', default: 33 })
  maxPallets: number;

  @Column({
    name:      'max_weight_kg',
    type:      'decimal',
    precision: 12,
    scale:     2,
    default:   24000,
  })
  maxWeightKg: number;

  /**
   * Гос. номер фуры — необязательный, заполняет менеджер.
   * Отображается в планировщике и инвойсе.
   */
  @Column({ name: 'license_plate', nullable: true, length: 20 })
  licensePlate: string | null;

  /**
   * Имя водителя / экспедитора — необязательный.
   */
  @Column({ name: 'driver_name', nullable: true, length: 255 })
  driverName: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // ── Computed ──────────────────────────────────────────────────────────
  get displayName(): string {
    return this.licensePlate
      ? `Фура ${this.number} (${this.licensePlate})`
      : `Фура ${this.number}`;
  }
}
