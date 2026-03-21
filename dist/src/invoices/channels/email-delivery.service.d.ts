import { ConfigService } from '@nestjs/config';
export interface EmailSendResult {
    ok: boolean;
    messageId?: string;
    error?: string;
}
export declare class EmailDeliveryService {
    private readonly config;
    private readonly logger;
    private readonly from;
    private readonly fromName;
    constructor(config: ConfigService);
    sendInvoice(to: string, pdfBuffer: Buffer, invoiceNumber: string, params: {
        companyName: string;
        contactName: string;
        orderId: number;
        totalEur: number;
        dueDate: string;
        subtotalEur: number;
        vatRate: number;
        vatAmount: number;
    }): Promise<EmailSendResult>;
    private buildHtmlBody;
    private buildTextBody;
}
