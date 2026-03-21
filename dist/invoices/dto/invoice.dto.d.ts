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
