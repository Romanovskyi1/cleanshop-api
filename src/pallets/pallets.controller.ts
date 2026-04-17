import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseIntPipe, HttpCode, HttpStatus, NotFoundException, Headers,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { PalletsService }   from './pallets.service';
import {
  CreatePalletDto, UpdatePalletDto,
  AddPalletItemDto, UpdatePalletItemDto,
  AssignPalletsToTruckDto, PalletQueryDto,
} from './dto/pallet.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User }        from '../users/user.entity';
import { Product }     from '../products/entities/product.entity';

@Controller('pallets')
export class PalletsController {
  constructor(
    private readonly service: PalletsService,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  // ── Паллеты ──────────────────────────────────────────────────────────────

  /**
   * GET /pallets
   * Все паллеты компании текущего клиента.
   */
  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query() query: PalletQueryDto,
  ) {
    return this.service.findAll(user.companyId, query);
  }

  /**
   * GET /pallets/:id
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.service.findOne(id, user.companyId);
  }

  /**
   * POST /pallets
   * Создать новую паллету.
   */
  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreatePalletDto,
  ) {
    return this.service.create(user.companyId, dto);
  }

  /**
   * PATCH /pallets/:id
   * Переименовать, назначить/убрать из фуры.
   */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdatePalletDto,
  ) {
    return this.service.update(id, user.companyId, dto);
  }

  /**
   * DELETE /pallets/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.service.remove(id, user.companyId);
  }

  // ── Позиции паллеты ───────────────────────────────────────────────────────

  /**
   * POST /pallets/:id/items
   * Добавить товар в паллету.
   *
   * В реальном коде здесь нужно получить данные продукта (цена, кратность)
   * из ProductsService. Здесь передаём через body для простоты MVP.
   */
  @Post(':id/items')
  async addItem(
    @Param('id', ParseIntPipe) palletId: number,
    @CurrentUser() user: User,
    @Body() dto: AddPalletItemDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    const product = await this.products.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Товар #${dto.productId} не найден`);
    const productData = {
      priceEur:       Number(product.priceEur),
      unitsPerBox:    product.unitsPerBox,
      weightPerBoxKg: product.boxWeightKg ? Number(product.boxWeightKg) : undefined,
    };
    return this.service.addItem(palletId, user.companyId, dto, productData, idempotencyKey);
  }

  /**
   * PATCH /pallets/:id/items/:itemId
   * Изменить количество коробок.
   */
  @Patch(':id/items/:itemId')
  async updateItem(
    @Param('id',     ParseIntPipe) palletId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
    @Body() dto: UpdatePalletItemDto,
  ) {
    const item = await this.service.findItemById(itemId, palletId);
    const product = await this.products.findOne({ where: { id: item.productId } });
    if (!product) throw new NotFoundException(`Товар #${item.productId} не найден`);
    const productData = {
      priceEur:       Number(product.priceEur),
      unitsPerBox:    product.unitsPerBox,
      weightPerBoxKg: product.boxWeightKg ? Number(product.boxWeightKg) : undefined,
    };
    return this.service.updateItem(palletId, itemId, user.companyId, dto, productData);
  }

  /**
   * DELETE /pallets/:id/items/:itemId
   */
  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(
    @Param('id',     ParseIntPipe) palletId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.removeItem(palletId, itemId, user.companyId);
  }

  // ── Планировщик фур ───────────────────────────────────────────────────────

  /**
   * GET /pallets/trucks/:orderId/summary
   * Сводка по фурам: паллеты, заполнение, вес.
   */
  @Get('trucks/:orderId/summary')
  trucksSummary(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.getTrucksSummary(orderId, user.companyId);
  }

  /**
   * GET /pallets/trucks/:orderId/unassigned
   * Нераспределённые паллеты заказа.
   */
  @Get('trucks/:orderId/unassigned')
  unassigned(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.getUnassigned(orderId, user.companyId);
  }

  /**
   * PATCH /pallets/trucks/:orderId/:truckId
   * Назначить набор паллет в фуру (batch).
   * Тело: { palletIds: [1, 2, 3] }
   */
  @Patch('trucks/:orderId/:truckId')
  assignToTruck(
    @Param('orderId',  ParseIntPipe) orderId: number,
    @Param('truckId',  ParseIntPipe) truckId: number,
    @CurrentUser() user: User,
    @Body() dto: AssignPalletsToTruckDto,
  ) {
    return this.service.assignPalletsToTruck(truckId, orderId, user.companyId, dto);
  }

  /**
   * DELETE /pallets/:id/truck
   * Убрать паллету из фуры.
   */
  @Delete(':id/truck')
  @HttpCode(HttpStatus.OK)
  removeFromTruck(
    @Param('id', ParseIntPipe) palletId: number,
    @CurrentUser() user: User,
  ) {
    return this.service.removePalletFromTruck(palletId, user.companyId);
  }
}
