import { InvoicesService } from './invoices.service';
import { UploadInvoiceDto, UpdateInvoiceStatusDto, ResendInvoiceDto, InvoiceQueryDto } from './dto/invoice.dto';
import { User } from '../users/user.entity';
export declare class InvoicesController {
    private readonly service;
    constructor(service: InvoicesService);
    upload(file: Express.Multer.File, dto: UploadInvoiceDto, manager: User): Promise<{
        invoice: import("./entities/invoice.entity").Invoice;
        distribution: UploadInvoiceDto;
    }>;
    findAll(user: User, query: InvoiceQueryDto): Promise<import("./entities/invoice.entity").Invoice[]>;
    findOne(id: number, user: User): Promise<import("./entities/invoice.entity").Invoice>;
    getDownloadUrl(id: number, user: User): Promise<string>;
    getDeliveryStatus(id: number): Promise<import("./entities/invoice.entity").InvoiceDelivery[]>;
    updateStatus(id: number, dto: UpdateInvoiceStatusDto, manager: User): Promise<import("./entities/invoice.entity").Invoice>;
    resend(id: number, dto: ResendInvoiceDto, manager: User): Promise<DistributionResult>;
    private resolveContacts;
}
