import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

export enum SenderType {
  CLIENT  = 'client',
  MANAGER = 'manager',
  AI      = 'ai',
}

export enum MessageIntent {
  INFORMATIONAL  = 'informational',  // вопрос о товаре, условиях
  TRANSACTIONAL  = 'transactional',  // заказ, счёт, паллеты
  LOGISTICAL     = 'logistical',     // статус заказа, доставка
  COMPLAINT      = 'complaint',      // жалоба, возврат
  ESCALATE       = 'escalate',       // нестандарт → менеджеру
}

@Entity('chat_messages')
@Index(['companyId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Index()
  @Column({ name: 'company_id' })
  companyId: number;

  /** NULL = ИИ-ассистент */
  @Column({ name: 'sender_id', nullable: true })
  senderId: number | null;

  @Column({
    name: 'sender_type',
    type: 'enum',
    enum: SenderType,
  })
  senderType: SenderType;

  @Column({ type: 'text' })
  text: string;

  /** URL прикреплённого файла / фото */
  @Column({ name: 'attachment_url', nullable: true })
  attachmentUrl: string | null;

  /**
   * Классификация интента (только для входящих сообщений клиента).
   * Проставляется ИИ при анализе запроса.
   */
  @Column({
    type: 'enum',
    enum: MessageIntent,
    nullable: true,
  })
  intent: MessageIntent | null;

  /**
   * Структурированный payload для CardMessage.
   * Пример: { type: 'price_card', productId: 1, ... }
   */
  @Column({ name: 'card_payload', type: 'jsonb', nullable: true })
  cardPayload: Record<string, unknown> | null;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
