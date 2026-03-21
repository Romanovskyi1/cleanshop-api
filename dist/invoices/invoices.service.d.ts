import { Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { UploadInvoiceDto, UpdateInvoiceStatusDto, InvoiceQueryDto, DistributionResult } from './dto/invoice.dto';
import { InvoiceDistributionService, ClientDeliveryContacts } from './invoice-distribution.service';
import { S3StorageService } from './channels/s3-storage.service';
export declare class InvoicesService {
    private readonly invoices;
    private readonly distribution;
    private readonly s3;
    private readonly logger;
    constructor(invoices: Repository<Invoice>, distribution: InvoiceDistributionService, s3: S3StorageService);
    uploadAndDistribute(managerId: number, dto: UploadInvoiceDto, pdfBuffer: Buffer, filename: string, contacts: ClientDeliveryContacts): Promise<{
        invoice: Invoice;
        distribution: DistributionResult;
    }>;
    resend(invoiceId: number, managerId: number, channels: string[] | undefined, contacts: ClientDeliveryContacts): Promise<DistributionResult>;
    findAll(query: InvoiceQueryDto): Promise<Invoice[]>;
    findById(id: number): Promise<Invoice>;
    findByCompany(companyId: number): Promise<Invoice[]>;
    updateStatus(id: number, managerId: number, dto: UpdateInvoiceStatusDto): Promise<Invoice>;
    getDeliveryStatus(invoiceId: number): Promise<import("./entities/invoice.entity").InvoiceDelivery[]>;
    getDownloadUrl(invoiceId: number, companyId: number): Promise<string>;
    private resolveChannels;
}
