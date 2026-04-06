// src/users/users.controller.ts
import {
  Controller, Get, Patch, Param, Body, Query, ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { UsersService }     from './users.service';
import { Roles }            from '../common/decorators/roles.decorator';
import { User, UserRole }   from './user.entity';

@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @Roles(UserRole.MANAGER)
  findAll(@Query('companyId') companyId?: string) {
    if (companyId) {
      return this.repo.find({
        where: { companyId: parseInt(companyId, 10) },
        order: { createdAt: 'DESC' },
      });
    }
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  @Get('by-telegram/:telegramId')
  @Roles(UserRole.MANAGER)
  findByTelegramId(@Param('telegramId') telegramId: string) {
    return this.usersService.findByTelegramId(telegramId);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { role?: UserRole; companyId?: number | null },
  ) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException(`Пользователь #${id} не найден`);
    if (body.role      !== undefined) user.role      = body.role;
    if (body.companyId !== undefined) user.companyId = body.companyId;
    return this.repo.save(user);
  }
}
