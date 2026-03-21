// src/companies/companies.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CompaniesService }  from './companies.service';
import {
  CreateCompanyDto, UpdateCompanyDto, SetGroupChatDto,
} from './dto/company.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles }       from '../common/decorators/roles.decorator';
import { User, UserRole } from '../users/user.entity';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  /**
   * GET /companies
   * Список всех компаний.
   * Клиент получает только свою — проверяем companyId из токена.
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
   * Обновить реквизиты (manager — для своих клиентов, admin — для любой).
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
   * Это отдельный endpoint — изменение влияет на рассылку инвойсов.
   *
   * Как узнать groupChatId:
   *  1. Добавить бота в группу
   *  2. Написать любое сообщение
   *  3. GET https://api.telegram.org/bot{TOKEN}/getUpdates
   *  4. В ответе найти message.chat.id (отрицательное число)
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
