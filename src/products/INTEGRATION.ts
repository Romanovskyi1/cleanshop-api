/**
 * ИНТЕГРАЦИЯ: ProductsService → PalletsService
 * ============================================
 *
 * Этот файл показывает как подключить ProductsService в PalletsService
 * чтобы убрать захардкоженные productData из контроллера.
 *
 * Шаг 1: Добавь ProductsModule в imports PalletsModule
 * ────────────────────────────────────────────────────
 *
 * // pallets.module.ts
 * import { ProductsModule } from '../products/products.module';
 *
 * @Module({
 *   imports: [
 *     TypeOrmModule.forFeature([Pallet, PalletItem, Truck]),
 *     ProductsModule,   // ← добавить
 *   ],
 *   ...
 * })
 * export class PalletsModule {}
 *
 *
 * Шаг 2: Инжектируй ProductsService в PalletsService
 * ───────────────────────────────────────────────────
 *
 * // pallets.service.ts
 * import { ProductsService } from '../products/products.service';
 *
 * constructor(
 *   @InjectRepository(Pallet)     private readonly pallets: Repository<Pallet>,
 *   @InjectRepository(PalletItem) private readonly items:   Repository<PalletItem>,
 *   @InjectRepository(Truck)      private readonly trucks:  Repository<Truck>,
 *   private readonly ds:          DataSource,
 *   private readonly products:    ProductsService,   // ← добавить
 * ) {}
 *
 *
 * Шаг 3: Обнови метод addItem в PalletsController
 * ────────────────────────────────────────────────
 *
 * // pallets.controller.ts — замени заглушку на реальный вызов:
 *
 * @Post(':id/items')
 * async addItem(
 *   @Param('id', ParseIntPipe) palletId: number,
 *   @CurrentUser() user: User,
 *   @Body() dto: AddPalletItemDto,
 * ) {
 *   // Получаем реальные данные продукта
 *   const productData = await this.productsService.getPalletData(dto.productId);
 *
 *   return this.palletsService.addItem(palletId, user.companyId, dto, productData);
 * }
 *
 * // Добавь ProductsService в конструктор контроллера:
 * constructor(
 *   private readonly palletsService:  PalletsService,
 *   private readonly productsService: ProductsService,
 * ) {}
 *
 *
 * Шаг 4: Аналогично для updateItem
 * ──────────────────────────────────
 *
 * @Patch(':id/items/:itemId')
 * async updateItem(
 *   @Param('id',     ParseIntPipe) palletId: number,
 *   @Param('itemId', ParseIntPipe) itemId: number,
 *   @CurrentUser() user: User,
 *   @Body() dto: UpdatePalletItemDto,
 * ) {
 *   const item = await this.palletsService.getItem(itemId, palletId, user.companyId);
 *   const productData = await this.productsService.getPalletData(item.productId);
 *   return this.palletsService.updateItem(palletId, itemId, user.companyId, dto, productData);
 * }
 *
 *
 * Итог: цепочка вызовов
 * ─────────────────────
 *
 * POST /pallets/:id/items
 *   → PalletsController.addItem()
 *     → ProductsService.getPalletData(productId)   ← реальная цена и кратность
 *       → PalletsService.addItem(...)              ← валидация и сохранение
 */

export {}; // файл только для документации
