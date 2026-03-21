// src/orders/entities/order-status-history.entity.ts
//
// Каждое изменение статуса пишется в эту таблицу.
// Используется для таймлайна согласования в TMA и аудита.

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';
import { OrderStatus } from './order.entity';

@Entity('order_status_history')
@Index(['orderId', 'createdAt'])
export class OrderStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'order_id' })
  orderId: number;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: OrderStatus,
    nullable: true,
  })
  fromStatus: OrderStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: OrderStatus,
  })
  toStatus: OrderStatus;

  /** Кто сделал переход (NULL = система/Cron) */
  @Column({ name: 'actor_id', nullable: true })
  actorId: number | null;

  /** Роль актора на момент перехода */
  @Column({ name: 'actor_role', nullable: true, length: 20 })
  actorRole: string | null;

  @Column({ nullable: true, length: 500 })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
