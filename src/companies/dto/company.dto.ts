// src/companies/dto/company.dto.ts
import {
  IsString, IsNotEmpty, IsOptional, IsEmail,
  IsEnum, IsBoolean, IsNumber, Min, Max,
  MaxLength, Length, IsDecimal,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceTerms } from '../entities/company.entity';

// ── Создать компанию ─────────────────────────────────────────────────────────
export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vatNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;

  @IsString()
  @Length(2, 2)
  countryCode: string;

  @IsOptional()
  @IsEmail()
  invoiceEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telegramGroupChatId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryContactName?: string;

  @IsOptional()
  @IsEnum(InvoiceTerms)
  invoiceTerms?: InvoiceTerms;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  vatRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ── Обновить компанию ────────────────────────────────────────────────────────
export class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(500)   name?:                string;
  @IsOptional() @IsString() @MaxLength(50)    vatNumber?:           string;
  @IsOptional() @IsString() @MaxLength(1000)  address?:             string;
  @IsOptional() @IsString() @Length(2, 2)     countryCode?:         string;
  @IsOptional() @IsEmail()                    invoiceEmail?:        string;
  @IsOptional() @IsString() @MaxLength(30)    telegramGroupChatId?: string;
  @IsOptional() @IsString() @MaxLength(255)   primaryContactName?:  string;
  @IsOptional() @IsEnum(InvoiceTerms)         invoiceTerms?:        InvoiceTerms;
  @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number) vatRate?: number;
  @IsOptional() @IsString() @MaxLength(34)    iban?:                string;
  @IsOptional() @IsBoolean()                  isActive?:            boolean;
  @IsOptional() @IsString() @MaxLength(2000)  notes?:               string;
}

// ── Привязать Telegram-группу (отдельный эндпоинт — чувствительное действие) ─
export class SetGroupChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  telegramGroupChatId: string; // -1001234567890
}

// ── Ответ: контакты для рассылки (используется InvoicesController) ──────────
export interface DeliveryContacts {
  companyName:         string;
  contactName:         string;
  telegramId:          string;        // личный chat_id основного контакта
  groupChatId:         string | null; // групповой чат
  email:               string | null; // invoice email
  vatRate:             number;        // для расчёта НДС в инвойсе
  invoiceTerms:        InvoiceTerms;
  dueDateStr:          string;        // YYYY-MM-DD вычисленный due date
}
