import { ConfigService } from '@nestjs/config';
export interface TelegramSendResult {
    ok: boolean;
    messageId?: number;
    error?: string;
}
export declare class TelegramDeliveryService {
    private readonly config;
    private readonly logger;
    private readonly baseUrl;
    constructor(config: ConfigService);
    sendToPersonalChat(telegramId: string, pdfBuffer: Buffer, caption: string, filename: string): Promise<TelegramSendResult>;
    sendToGroupChat(groupChatId: string, pdfBuffer: Buffer, caption: string, filename: string): Promise<TelegramSendResult>;
    notifyManager(chatId: string, text: string): Promise<TelegramSendResult>;
    private sendDocument;
    private sendMessage;
    static buildCaption(params: {
        invoiceNumber: string;
        companyName: string;
        totalEur: number;
        dueDate: string;
        orderId: number;
    }): string;
}
