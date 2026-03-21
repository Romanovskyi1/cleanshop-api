import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum UserRole {
  CLIENT  = 'client',
  MANAGER = 'manager',
  ADMIN   = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'bigint', name: 'telegram_id' })
  telegramId: string; // bigint → string, чтобы избежать потери точности в JS

  @Column({ nullable: true })
  username: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ name: 'language_code', default: 'en', length: 10 })
  languageCode: string;

  @Column({ name: 'company_id', nullable: true })
  companyId: number;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role: UserRole;

  @Column({ name: 'gdpr_consent_at', type: 'timestamptz', nullable: true })
  gdprConsentAt: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // ── helpers ──────────────────────────────────────────────────────────
  get isManager(): boolean {
    return this.role === UserRole.MANAGER || this.role === UserRole.ADMIN;
  }

  get isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  get displayName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
      || this.username
      || `User#${this.id}`;
  }
}
