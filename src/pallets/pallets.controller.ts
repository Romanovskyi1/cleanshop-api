import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseIntPipe, HttpCode, HttpStatus, Headers,
} from '@nestjs/common';
import { PalletsService } from './pallets.service';
import {
  CreatePalletDto, UpdatePalletDto,
  AddPalletsDto, AssignPalletsToTruckDto, PalletQueryDto,
} from './dto/pallet.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User }        from '../users/user.entity';

/**
 * Моно-паллетная модель: 1 паллета = 1 SKU.
 *
 * Решение по роуту добавления паллет:
 * выбрано `POST /pallets/orders/:orderId` (а не `/orders/:orderId/pallets`).
 * Причина: вся доменная логика сборки паллет живёт в PalletsService,
 * и OrdersController не должен знать о PalletsService (избегаем cross-module
 * зависимостей и дубликатов DI). Путь остаётся семантически корректным:
 * `/pallets/...` — операции над паллетами, `orders/:orderId` — контекст.
 */
@Controller('pallets')
export class PalletsController {
  constructor(private readonly service: PalletsService) {}

  // ── Чтение ───────────────────────────────────────────────────────────────

  @Get()
  findAll(@CurrentUser() user: User, @Query() query: PalletQueryDto) {
    return this.service.findAll(user.companyId, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.service.findOne(id, user.companyId);
  }

  // ── Доменный вход: добавить N паллет SKU в заказ ─────────────────────────

  @Post('orders/:orderId')
  @HttpCode(HttpStatus.CREATED)
  addPallets(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: User,
    @Body() dto: AddPalletsDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.service.addPallets(orderId, user.companyId, dto, idempotencyKey);
  }

  // ── Низкоуровневое создание (без консолидации) ───────────────────────────

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreatePalletDto) {
    return this.service.create(user.companyId, dto);
  }

  // ── Обновление (в т.ч. palletsCount, 0 → удаление) ───────────────────────

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdatePalletDto,
  ) {
    return this.service.update(id, user.companyId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.service.remove(id, user.companyId);
  }

  // ── Планировщик фур ──────────────────────────────────────────────────────

  @Get('trucks/:orderId/summary')
  trucksSummary(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.getTrucksSummary(orderId, user.companyId);
  }

  @Get('trucks/:orderId/unassigned')
  unassigned(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.getUnassigned(orderId, user.companyId);
  }

  @Patch('trucks/:orderId/:truckId')
  assignToTruck(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('truckId', ParseIntPipe) truckId: number,
    @CurrentUser() user: User,
    @Body() dto: AssignPalletsToTruckDto,
  ) {
    return this.service.assignPalletsToTruck(truckId, orderId, user.companyId, dto);
  }

  @Delete(':id/truck')
  @HttpCode(HttpStatus.OK)
  removeFromTruck(
    @Param('id', ParseIntPipe) palletId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.removePalletFromTruck(palletId, user.companyId);
  }
}
