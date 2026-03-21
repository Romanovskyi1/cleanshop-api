import { Repository } from 'typeorm';
import { Company, InvoiceTerms } from './entities/company.entity';
import { CreateCompanyDto, UpdateCompanyDto, DeliveryContacts } from './dto/company.dto';
export interface IUser {
    id: number;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    displayName: string;
    companyId: number | null;
}
export declare class CompaniesService {
    private readonly repo;
    private readonly logger;
    constructor(repo: Repository<Company>);
    findAll(): Promise<Company[]>;
    findById(id: number): Promise<Company>;
    create(dto: CreateCompanyDto): Promise<Company>;
    update(id: number, dto: UpdateCompanyDto): Promise<Company>;
    setGroupChat(id: number, chatId: string): Promise<Company>;
    deactivate(id: number): Promise<Company>;
    resolveDeliveryContacts(companyId: number, contact: IUser, issuedAt: Date): Promise<DeliveryContacts>;
    getVatRate(companyId: number): Promise<number>;
    getInvoiceTerms(companyId: number): Promise<InvoiceTerms>;
    private validateGroupChatId;
}
