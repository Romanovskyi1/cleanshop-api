import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto, SetGroupChatDto } from './dto/company.dto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
declare class RegisterClientDto {
    companyName: string;
    countryCode: string;
    telegramId: string;
    email?: string;
    vatNumber?: string;
    contactName?: string;
}
export declare class CompaniesController {
    private readonly service;
    private readonly usersService;
    constructor(service: CompaniesService, usersService: UsersService);
    findAll(): Promise<import("./entities/company.entity").Company[]>;
    getMyCompany(user: User): Promise<import("./entities/company.entity").Company>;
    registerClient(dto: RegisterClientDto): Promise<{
        company: import("./entities/company.entity").Company;
        userId: number;
    }>;
    findOne(id: number): Promise<import("./entities/company.entity").Company>;
    create(dto: CreateCompanyDto): Promise<import("./entities/company.entity").Company>;
    update(id: number, dto: UpdateCompanyDto): Promise<import("./entities/company.entity").Company>;
    setGroupChat(id: number, dto: SetGroupChatDto): Promise<import("./entities/company.entity").Company>;
    deactivate(id: number): Promise<import("./entities/company.entity").Company>;
}
export {};
