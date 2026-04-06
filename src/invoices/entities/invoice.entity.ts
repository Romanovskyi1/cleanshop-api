import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index, OneToMany,
} from 'typeorm';

export enum InvoiceStatus {
  PENDING   = 'pending',
  PAID      = 'paid',
  OVERDUE   = 'overdue',
  CANCELLED = 'cancelled',
}

export enum DeliveryChannel {
  TELEGRAM_PERSONAL = 'telegram_personal',
  TELEGRAM_GROUP    = 'telegram_group',
  EMAIL             = 'email',
}

export enum DeliveryStatus {
  SENT   = 'sent',
  FAILED = 'failed',
  RESENT = 'resent',
}

@Entity('invoices')
@Index(['companyId', 'status'])
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ name: 'invoice_number', length: 50 })
  invoiceNumber: string;

  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'order_id', nullable: true })
  orderId: number | null;

  @CreateDateColumn({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'subtotal_eur', type: 'decimal', precision: 14, scale: 2 })
  subtotalEur: number;

  @Column({ name: 'vat_rate', type: 'decimal', precision: 5, scale: 2 })
  vatRate: number;

  @Column({ name: 'vat_amount', type: 'decimal', precision: 14, scale: 2 })
  vatAmount: number;

  @Column({ name: 'total_eur', type: 'decimal', precision: 14, scale: 2 })
  totalEur: number;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  status: InvoiceStatus;

  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => InvoiceDelivery, d => d.invoice, { cascade: true })
  deliveries: InvoiceDelivery[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  get isOverdue(): boolean {
    return this.status === InvoiceStatus.PENDING && new Date(this.dueDate) < new Date();
  }
}

@Entity('invoice_deliveries')
@Index(['invoiceId', 'channel'])
export class InvoiceDelivery {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'invoice_id' })
  invoiceId: number;

  invoice: Invoice;

  @Column({ type: 'enum', enum: DeliveryChannel })
  channel: DeliveryChannel;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.SENT })
  status: DeliveryStatus;

  @Column({ name: 'recipient', nullable: true })
  recipient: string | null;

  @Column({ name: 'error', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
