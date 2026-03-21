// src/orders/orders.controller.ts
import {
  Controller, Get, Post, Patch, Param,
  Body, Query, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { OrdersService }   from './orders.service';
import {
  CreateOrderDto, ProposeDateDto, ConfirmDateDto,
  ConfirmPlanDto, CancelOrderDto, ShipOrderDto,
  UpdateOrderDto, OrderQueryDto,
} from './dto/order.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles }       from '../common/decorators/roles.decorator';
import { User, UserRole } from '../users/user.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  // ── Список ──────────────────────────────────────────────────────────────────

  /**
   * GET /orders
   * Клиент видит только свои заказы.
   * Менеджер видит все (с опциональной фильтрацией).
   */
  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query() query: OrderQueryDto,
  ) {
    // Клиент — всегда фильтр по своей компании
    const companyId = user.isManager ? undefined : user.companyId;
    return this.service.findAll(query, companyId);
  }

  /**
   * GET /orders/stats
   * Агрегаты для дашборда.
   */
  @Get('stats')
  getStats(@CurrentUser() user: User) {
    const companyId = user.isManager ? undefined : user.companyId;
    return this.service.getDashboardStats(companyId);
  }

  /**
   * GET /orders/:id
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    const companyId = user.isManager ? undefined : user.companyId;
    return this.service.findOne(id, companyId);
  }

  /**
   * GET /orders/:id/history
   * Таймлайн согласования — все переходы статусов.
   */
  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.service.getHistory(id);
  }

  // ── Создание / редактирование ────────────────────────────────────────────────

  /**
   * POST /orders
   * Клиент создаёт черновик (опционально с датой).
   */
  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateOrderDto,
  ) {
    return this.service.create(user.companyId, user.id, dto);
  }

  /**
   * PATCH /orders/:id
   * Обновить заметки / количество фур.
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateOrderDto,
  ) {
    const companyId = user.isManager ? undefined : user.companyId;
    return this.service.update(id, companyId ?? user.companyId, dto);
  }

  // ── Согласование дат ──────────────────────────────────────────────────────────

  /**
   * POST /orders/:id/propose-date
   * Клиент предлагает дату погрузки.
   * draft → negotiating  или  повторное предложение в negotiating
   */
  @Post(':id/propose-date')
  @HttpCode(HttpStatus.OK)
  proposeDate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: ProposeDateDto,
  ) {
    return this.service.proposeDate(id, user.companyId, user.id, dto);
  }

  /**
   * POST /orders/:id/confirm-date
   * Менеджер подтверждает дату.
   * negotiating → confirmed
   */
  @Post(':id/confirm-date')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  confirmDate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() manager: User,
    @Body() dto: ConfirmDateDto,
  ) {
    return this.service.confirmDate(id, manager.id, dto);
  }

  // ── Паллеты ───────────────────────────────────────────────────────────────────

  /**
   * POST /orders/:id/confirm-plan
   * Клиент подтверждает план распределения паллет.
   * building → locked
   */
  @Post(':id/confirm-plan')
  @HttpCode(HttpStatus.OK)
  confirmPlan(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: ConfirmPlanDto,
  ) {
    return this.service.confirmPlan(id, user.companyId, user.id, dto);
  }

  // ── Менеджерские действия ─────────────────────────────────────────────────────

  /**
   * POST /orders/:id/ship
   * Менеджер отмечает отгрузку.
   * locked → shipped
   */
  @Post(':id/ship')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  ship(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() manager: User,
    @Body() dto: ShipOrderDto,
  ) {
    return this.service.ship(id, manager.id, dto);
  }

  /**
   * POST /orders/:id/cancel
   * Отменить заказ.
   * Любой статус кроме shipped → cancelled
   */
  @Post(':id/cancel')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() manager: User,
    @Body() dto: CancelOrderDto,
  ) {
    return this.service.cancel(id, manager.id, dto);
  }
}
