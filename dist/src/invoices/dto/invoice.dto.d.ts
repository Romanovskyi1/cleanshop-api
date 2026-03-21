import { InvoiceStatus } from '../entities/invoice.entity';
export declare class CreateInvoiceDto {
    companyId: number;
    orderId?: number;
    invoiceNumber: string;
    dueDate: string;
    subtotalEur: number;
    vatRate: number;
}
export declare class UpdateInvoiceStatusDto {
    status: InvoiceStatus;
}
export declare class ResendInvoiceDto {
    channels?: ('telegram_personal' | 'telegram_group' | 'email')[];
}
export declare class InvoiceQueryDto {
    orderId?: number;
    companyId?: number;
    status?: InvoiceStatus;
    page?: number;
    limit?: number;
}
export interface CompanyContactData {
    companyName: string;
    contactName: string;
    telegramUserId: string;
    telegramGroupId: string;
    email: string;
    languageCode: string;
}
export declare class UploadInvoiceDto {
    companyId: number;
    orderId?: number;
    invoiceNumber: string;
    issuedAt?: string;
    dueDate: string;
    subtotalEur: number;
    vatRate: number;
    vatAmount: number;
    totalEur: number;
    originalFilename?: string;
    channels?: ('telegram_personal' | 'telegram_group' | 'email')[];
}
export interface DistributionResult {
    invoiceId?: number;
    telegram_personal?: {
        ok: boolean;
        messageId?: number;
        error?: string;
    };
    telegram_group?: {
        ok: boolean;
        messageId?: number;
        error?: string;
    };
    email?: {
        ok: boolean;
        error?: string;
    };
    pdfUrl?: string;
    [key: string]: any;
}
