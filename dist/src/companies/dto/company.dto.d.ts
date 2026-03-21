import { InvoiceTerms } from '../entities/company.entity';
export declare class CreateCompanyDto {
    name: string;
    vatNumber?: string;
    address?: string;
    countryCode: string;
    invoiceEmail?: string;
    telegramGroupChatId?: string;
    primaryContactName?: string;
    invoiceTerms?: InvoiceTerms;
    vatRate?: number;
    iban?: string;
    notes?: string;
}
export declare class UpdateCompanyDto {
    name?: string;
    vatNumber?: string;
    address?: string;
    countryCode?: string;
    invoiceEmail?: string;
    telegramGroupChatId?: string;
    primaryContactName?: string;
    invoiceTerms?: InvoiceTerms;
    vatRate?: number;
    iban?: string;
    isActive?: boolean;
    notes?: string;
}
export declare class SetGroupChatDto {
    telegramGroupChatId: string;
}
export interface DeliveryContacts {
    companyName: string;
    contactName: string;
    telegramId: string;
    groupChatId: string | null;
    email: string | null;
    vatRate: number;
    invoiceTerms: InvoiceTerms;
    dueDateStr: string;
}
