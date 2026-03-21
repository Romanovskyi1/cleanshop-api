export declare enum InvoiceTerms {
    NET_15 = "NET15",
    NET_30 = "NET30",
    NET_60 = "NET60"
}
export declare class Company {
    id: number;
    name: string;
    vatNumber: string | null;
    address: string | null;
    countryCode: string;
    invoiceEmail: string | null;
    telegramGroupChatId: string | null;
    primaryContactName: string | null;
    invoiceTerms: InvoiceTerms;
    vatRate: number;
    iban: string | null;
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    get paymentDays(): number;
    calcDueDate(issuedAt: Date): Date;
    calcDueDateStr(issuedAt: Date): string;
}
