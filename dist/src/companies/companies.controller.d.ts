import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto, SetGroupChatDto } from './dto/company.dto';
import { User } from '../users/user.entity';
export declare class CompaniesController {
    private readonly service;
    constructor(service: CompaniesService);
    findAll(): Promise<import("./entities/company.entity").Company[]>;
    getMyCompany(user: User): Promise<import("./entities/company.entity").Company>;
    findOne(id: number): Promise<import("./entities/company.entity").Company>;
    create(dto: CreateCompanyDto): Promise<import("./entities/company.entity").Company>;
    update(id: number, dto: UpdateCompanyDto): Promise<import("./entities/company.entity").Company>;
    setGroupChat(id: number, dto: SetGroupChatDto): Promise<import("./entities/company.entity").Company>;
    deactivate(id: number): Promise<import("./entities/company.entity").Company>;
}
