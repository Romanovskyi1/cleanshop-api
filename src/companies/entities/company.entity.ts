// src/companies/entities/company.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum InvoiceTerms {
  NET_15 = 'NET15',
  NET_30 = 'NET30',
  NET_60 = 'NET60',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  name: string;

  @Column({ name: 'vat_number', nullable: true, length: 50 })
  vatNumber: string | null;

  @Column({ nullable: true, type: 'text' })
  address: string | null;

  @Column({ name: 'country_code', length: 2, default: 'DE' })
  countryCode: string;  // ISO 3166-1 alpha-2

  // ── Контакты для рассылки инвойсов ───────────────────────────────────────

  /**
   * Email для отправки инвойсов.
   * Используется EmailDeliveryService.
   */
  @Column({ name: 'invoice_email', nullable: true, length: 255 })
  invoiceEmail: string | null;

  /**
   * Telegram ID группового чата (клиент + менеджер).
   * Формат: -1001234567890 (отрицательное число для supergroup)
   * Используется TelegramDeliveryService.sendToGroupChat()
   */
  @Column({ name: 'telegram_group_chat_id', nullable: true, length: 30 })
  telegramGroupChatId: string | null;

  /**
   * Имя отображаемого контакта — используется в письмах и Telegram-пушах.
   * Если не задан — берётся из User.displayName основного контакта.
   */
  @Column({ name: 'primary_contact_name', nullable: true, length: 255 })
  primaryContactName: string | null;

  // ── Финансовые настройки ─────────────────────────────────────────────────

  @Column({
    name:    'invoice_terms',
    type:    'enum',
    enum:    InvoiceTerms,
    default: InvoiceTerms.NET_30,
  })
  invoiceTerms: InvoiceTerms;

  /**
   * Ставка НДС клиента — зависит от страны.
   * PL = 23%, DE = 19%, AT = 20% и т.д.
   */
  @Column({
    name:      'vat_rate',
    type:      'decimal',
    precision: 5,
    scale:     2,
    default:   23.00,
  })
  vatRate: number;

  /**
   * IBAN клиента (не используется в MVP, для будущей интеграции).
   */
  @Column({ nullable: true, length: 34 })
  iban: string | null;

  // ── Флаги ────────────────────────────────────────────────────────────────

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Описание / заметки менеджера о компании.
   */
  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── Computed ─────────────────────────────────────────────────────────────

  /** Количество дней отсрочки платежа из условий */
  get paymentDays(): number {
    return parseInt(this.invoiceTerms.replace('NET', ''), 10);
  }

  /** Вычислить due_date для инвойса от даты выставления */
  calcDueDate(issuedAt: Date): Date {
    const due = new Date(issuedAt);
    due.setDate(due.getDate() + this.paymentDays);
    return due;
  }

  /** Форматировать due_date как YYYY-MM-DD */
  calcDueDateStr(issuedAt: Date): string {
    return this.calcDueDate(issuedAt).toISOString().slice(0, 10);
  }
}
