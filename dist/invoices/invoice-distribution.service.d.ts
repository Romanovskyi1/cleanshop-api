import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Invoice, InvoiceDelivery, DeliveryChannel } from './entities/invoice.entity';
import { S3StorageService } from './channels/s3-storage.service';
import { TelegramDeliveryService } from './channels/telegram-delivery.service';
import { EmailDeliveryService } from './channels/email-delivery.service';
import { DistributionResult } from './dto/invoice.dto';
export interface ClientDeliveryContacts {
    companyName: string;
    contactName: string;
    telegramId: string;
    groupChatId: string | null;
    email: string | null;
}
export declare class InvoiceDistributionService {
    private readonly deliveries;
    private readonly s3;
    private readonly telegram;
    private readonly email;
    private readonly config;
    private readonly logger;
    constructor(deliveries: Repository<InvoiceDelivery>, s3: S3StorageService, telegram: TelegramDeliveryService, email: EmailDeliveryService, config: ConfigService);
    distribute(invoice: Invoice, pdfBuffer: Buffer, contacts: ClientDeliveryContacts, channels?: DeliveryChannel[]): Promise<DistributionResult>;
    resend(invoice: Invoice, pdfBuffer: Buffer, contacts: ClientDeliveryContacts, channels?: DeliveryChannel[]): Promise<DistributionResult>;
    getDeliveryStatus(invoiceId: number): Promise<InvoiceDelivery[]>;
    private deliverToChannel;
    private notifyManagerAboutResult;
}
