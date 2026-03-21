import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseIntPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProductsService }    from './products.service';
import {
  CreateProductDto, UpdateProductDto, ProductQueryDto,
} from './dto/product.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles }       from '../common/decorators/roles.decorator';
import { Public }      from '../common/decorators/public.decorator';
import { User, UserRole } from '../users/user.entity';

@Controller('catalog')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // ── Публичный каталог (для клиентов) ────────────────────────────────────

  /**
   * GET /catalog
   * Список товаров: фильтры, поиск, пагинация.
   * Язык берётся из query ?lang=de или из профиля пользователя.
   */
  @Get()
  findAll(
    @Query() query: ProductQueryDto,
    @CurrentUser() user?: User,
  ) {
    // Если lang не передан явно — берём из профиля пользователя
    if (!query.lang && user?.languageCode) {
      query.lang = user.languageCode;
    }
    return this.service.findAll(query);
  }

  /**
   * GET /catalog/categories
   * Список категорий с количеством товаров.
   */
  @Get('categories')
  getCategories() {
    return this.service.getCategories();
  }

  /**
   * GET /catalog/:id
   * Карточка товара — полные данные.
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') lang: string,
    @CurrentUser() user?: User,
  ) {
    const effectiveLang = lang ?? user?.languageCode ?? 'en';
    return this.service.findOne(id, effectiveLang);
  }

  /**
   * GET /catalog/pallet-data/:id
   * Данные для добавления в паллету: цена, кратность, вес.
   * Используется PalletsService — не для отображения.
   */
  @Get('pallet-data/:id')
  getPalletData(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPalletData(id);
  }

  // ── Управление каталогом (только admin) ─────────────────────────────────

  /**
   * POST /catalog
   * Создать новый продукт.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateProductDto) {
    return this.service.adminCreate(dto);
  }

  /**
   * PATCH /catalog/:id
   * Обновить продукт (цена, остаток, название, флаги).
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.adminUpdate(id, dto);
  }

  /**
   * PATCH /catalog/:id/stock
   * Обновить остаток на складе.
   * Вызывается вебхуком из складской ERP или вручную менеджером.
   */
  @Patch(':id/stock')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('stockPallets', ParseIntPipe) stockPallets: number,
  ) {
    return this.service.updateStock(id, stockPallets);
  }

  /**
   * DELETE /catalog/:id
   * Скрыть продукт из каталога (soft delete).
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.adminRemove(id);
  }
}
