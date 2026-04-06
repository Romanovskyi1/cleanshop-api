// src/companies/companies.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CompaniesService }  from './companies.service';
import {
  CreateCompanyDto, UpdateCompanyDto, SetGroupChatDto,
} from './dto/company.dto';
import { UsersService }    from '../users/users.service';
import { CurrentUser }     from '../common/decorators/current-user.decorator';
import { Roles }           from '../common/decorators/roles.decorator';
import { User, UserRole }  from '../users/user.entity';
import { IsString, IsNotEmpty, IsOptional, IsEmail, Length } from 'class-validator';

class RegisterClientDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @Length(2, 2)
  countryCode: string;

  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsString()
  contactName?: string;
}

@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly service: CompaniesService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * GET /companies
   * Список всех компаний.
   */
  @Get()
  @Roles(UserRole.MANAGER)
  findAll() {
    return this.service.findAll();
  }

  /**
   * GET /companies/my
   * Своя компания — доступно клиенту.
   */
  @Get('my')
  getMyCompany(@CurrentUser() user: User) {
    if (!user.companyId) {
      return null;
    }
    return this.service.findById(user.companyId);
  }

  /**
   * POST /companies/register-client
   * Менеджер регистрирует нового клиента: создаёт компанию и привязывает пользователя.
   */
  @Post('register-client')
  @Roles(UserRole.MANAGER)
  async registerClient(@Body() dto: RegisterClientDto) {
    const company = await this.service.create({
      name:               dto.companyName,
      countryCode:        dto.countryCode,
      vatNumber:          dto.vatNumber,
      invoiceEmail:       dto.email,
      primaryContactName: dto.contactName,
    });

    const user = await this.usersService.findOrCreateByTelegramId(
      dto.telegramId,
      dto.contactName,
    );
    await this.usersService.linkToCompany(user.id, company.id);

    return { company, userId: user.id };
  }

  /**
   * GET /companies/:id
   */
  @Get(':id')
  @Roles(UserRole.MANAGER)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  /**
   * POST /companies
   * Создать компанию (admin).
   */
  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCompanyDto) {
    return this.service.create(dto);
  }

  /**
   * PATCH /companies/:id
   * Обновить реквизиты.
   */
  @Patch(':id')
  @Roles(UserRole.MANAGER)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.service.update(id, dto);
  }

  /**
   * PATCH /companies/:id/group-chat
   * Привязать Telegram-группу.
   */
  @Patch(':id/group-chat')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  setGroupChat(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetGroupChatDto,
  ) {
    return this.service.setGroupChat(id, dto.telegramGroupChatId);
  }

  /**
   * DELETE /companies/:id
   * Деактивировать компанию (soft delete).
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.service.deactivate(id);
  }
}
