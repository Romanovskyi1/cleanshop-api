import {
  IsString, IsInt, IsPositive, IsNumber,
  IsOptional, IsEnum, IsDateString, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '../entities/invoice.entity';

export class CreateInvoiceDto {
  @IsInt() @IsPositive() companyId: number;
  @IsOptional() @IsInt() @IsPositive() orderId?: number;
  @IsString() invoiceNumber: string;
  @IsDateString() dueDate: string;
  @IsNumber() @Min(0) @Type(() => Number) subtotalEur: number;
  @IsNumber() @Min(0) @Max(100) @Type(() => Number) vatRate: number;
}

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus) status: InvoiceStatus;
}

export class ResendInvoiceDto {
  @IsOptional()
  @IsEnum(['telegram_personal', 'telegram_group', 'email'], { each: true })
  channels?: ('telegram_personal' | 'telegram_group' | 'email')[];
}

export class InvoiceQueryDto {
  @IsOptional() @IsInt() @IsPositive() @Type(() => Number) orderId?: number;
  @IsOptional() @IsInt() @IsPositive() @Type(() => Number) companyId?: number;
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

export interface CompanyContactData {
  companyName:     string;
  contactName:     string;
  telegramUserId:  string;
  telegramGroupId: string;
  email:           string;
  languageCode:    string;
}

export class UploadInvoiceDto {
  @IsInt() @IsPositive() companyId: number;
  @IsOptional() @IsInt() @IsPositive() orderId?: number;
  @IsString() invoiceNumber: string;
  @IsOptional() @IsString() issuedAt?: string;
  @IsDateString() dueDate: string;
  @IsNumber() @Min(0) @Type(() => Number) subtotalEur: number;
  @IsNumber() @Min(0) @Max(100) @Type(() => Number) vatRate: number;
  @IsNumber() @Min(0) @Type(() => Number) vatAmount: number;
  @IsNumber() @Min(0) @Type(() => Number) totalEur: number;
  @IsOptional() @IsString() originalFilename?: string;
  @IsOptional() channels?: ('telegram_personal' | 'telegram_group' | 'email')[];
}

export interface DistributionResult {
  invoiceId?:         number;
  telegram_personal?: { ok: boolean; messageId?: number; error?: string };
  telegram_group?:    { ok: boolean; messageId?: number; error?: string };
  email?:             { ok: boolean; error?: string };
  pdfUrl?:            string;
  [key: string]:      any;
}
