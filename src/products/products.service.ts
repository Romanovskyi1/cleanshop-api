import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { Product, ProductCategory } from './entities/product.entity';
import {
  CreateProductDto, UpdateProductDto,
  ProductQueryDto, ProductListItemDto,
  PaginatedProductsDto,
} from './dto/product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // ПУБЛИЧНЫЙ КАТАЛОГ
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Получить список товаров с фильтрацией, поиском и пагинацией.
   * Используется клиентским экраном Каталог.
   */
  async findAll(query: ProductQueryDto): Promise<PaginatedProductsDto> {
    const lang  = query.lang ?? 'en';
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.is_active = true');

    // ── Поиск по SKU и названию (JSONB, по всем языкам) ─────────────────
    if (query.search) {
      const term = `%${query.search.toLowerCase()}%`;
      qb.andWhere(
        `(
          LOWER(p.sku) LIKE :term
          OR LOWER(p.name->>'ru') LIKE :term
          OR LOWER(p.name->>'en') LIKE :term
          OR LOWER(p.name->>'de') LIKE :term
          OR LOWER(p.name->>'pl') LIKE :term
        )`,
        { term },
      );
    }

    // ── Фильтры ──────────────────────────────────────────────────────────
    if (query.category) {
      qb.andWhere('p.category = :category', { category: query.category });
    }
    if (query.isEco === true) {
      qb.andWhere('p.is_eco = true');
    }
    if (query.inStock === true) {
      qb.andWhere('p.stock_pallets > 0');
    }
    if (query.isHit === true) {
      qb.andWhere('p.is_hit = true');
    }
    if (query.isNew === true) {
      qb.andWhere('p.is_new = true');
    }

    // ── Сортировка ───────────────────────────────────────────────────────
    this.applySorting(qb, query.sort, lang);

    // ── Пагинация ─────────────────────────────────────────────────────────
    const total = await qb.getCount();
    qb.skip((page - 1) * limit).take(limit);

    const products = await qb.getMany();

    return {
      items:      products.map(p => this.toListItem(p, lang)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Получить один товар по ID — полные данные для карточки.
   */
  async findOne(id: number, lang = 'en'): Promise<ProductListItemDto & {
    description:     string;
    palletsPerTruck: number;
    palletPriceEur:  number;
    palletWeightKg:  number;
  }> {
    const product = await this.repo.findOne({
      where: { id, isActive: true },
    });
    if (!product) throw new NotFoundException(`Продукт #${id} не найден`);

    return {
      ...this.toListItem(product, lang),
      description:     this.localise(product.description as Record<string, string>, lang),
      palletsPerTruck: product.palletsPerTruck,
      palletPriceEur:  product.palletPriceEur,
      palletWeightKg:  Number(product.palletWeightKg) || product.computedBoxWeightKg * product.boxesPerPallet,
    };
  }

  /**
   * Найти по SKU — используется в PalletsService для получения цены/кратности.
   */
  async findBySku(sku: string): Promise<Product> {
    const product = await this.repo.findOne({ where: { sku } });
    if (!product) throw new NotFoundException(`Продукт со SKU "${sku}" не найден`);
    return product;
  }

  /**
   * Получить данные для добавления в паллету:
   * цена, кратность, вес. Вызывается из PalletsService.
   */
  async getPalletData(productId: number): Promise<{
    priceEur:       number;
    unitsPerBox:    number;
    boxesPerPallet: number;
    boxWeightKg:    number;
  }> {
    const p = await this.repo.findOne({
      where: { id: productId, isActive: true },
      select: ['id', 'priceEur', 'unitsPerBox', 'boxesPerPallet', 'boxWeightKg', 'weightKg'],
    });
    if (!p) throw new NotFoundException(`Продукт #${productId} не найден`);

    return {
      priceEur:       Number(p.priceEur),
      unitsPerBox:    p.unitsPerBox,
      boxesPerPallet: p.boxesPerPallet,
      boxWeightKg:    p.computedBoxWeightKg,
    };
  }

  /**
   * Получить список категорий с количеством товаров.
   */
  async getCategories(): Promise<Array<{ category: ProductCategory; count: number }>> {
    const rows = await this.repo
      .createQueryBuilder('p')
      .select('p.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('p.is_active = true')
      .groupBy('p.category')
      .orderBy('count', 'DESC')
      .getRawMany<{ category: ProductCategory; count: string }>();

    return rows.map(r => ({ category: r.category, count: Number(r.count) }));
  }

  // ══════════════════════════════════════════════════════════════════════
  // ADMIN: управление каталогом
  // ══════════════════════════════════════════════════════════════════════

  async adminCreate(dto: CreateProductDto): Promise<Product> {
    const existing = await this.repo.findOne({ where: { sku: dto.sku } });
    if (existing) {
      throw new ConflictException(`Продукт со SKU "${dto.sku}" уже существует`);
    }

    const product = this.repo.create(dto);
    const saved   = await this.repo.save(product);
    this.logger.log(`Создан продукт SKU=${saved.sku} id=${saved.id}`);
    return saved;
  }

  async adminUpdate(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Продукт #${id} не найден`);

    Object.assign(product, dto);
    return this.repo.save(product);
  }

  /**
   * Обновить остаток паллет на складе.
   * Вызывается вебхуком из складской системы.
   */
  async updateStock(id: number, stockPallets: number): Promise<void> {
    await this.repo.update(id, { stockPallets });
    this.logger.log(`Stock updated: product #${id} → ${stockPallets} паллет`);
  }

  async adminRemove(id: number): Promise<void> {
    // Мягкое удаление — скрываем из каталога
    await this.repo.update(id, { isActive: false });
    this.logger.log(`Продукт #${id} скрыт из каталога`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════

  private applySorting(
    qb: SelectQueryBuilder<Product>,
    sort: ProductQueryDto['sort'],
    lang: string,
  ): void {
    switch (sort) {
      case 'price_asc':
        qb.orderBy('p.price_eur', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('p.price_eur', 'DESC');
        break;
      case 'name_asc':
        // Сортировка по локализованному названию через JSONB
        qb.orderBy(`p.name->>'${lang}'`, 'ASC', 'NULLS LAST');
        break;
      case 'stock':
        qb.orderBy('p.stock_pallets', 'DESC');
        break;
      case 'popularity':
      default:
        // Хиты вперёд, затем новинки, затем по ID (порядок добавления)
        qb.orderBy('p.is_hit', 'DESC')
          .addOrderBy('p.is_new', 'DESC')
          .addOrderBy('p.id', 'ASC');
        break;
    }
  }

  private toListItem(product: Product, lang: string): ProductListItemDto {
    return {
      id:             product.id,
      sku:            product.sku,
      name:           this.localise(product.name as Record<string, string>, lang),
      description:    this.localise(product.description as Record<string, string>, lang),
      category:       product.category,
      volumeL:        Number(product.volumeL) || null,
      priceEur:       Number(product.priceEur),
      boxPriceEur:    product.boxPriceEur,
      palletPriceEur: product.palletPriceEur,
      unitsPerBox:    product.unitsPerBox,
      boxesPerPallet: product.boxesPerPallet,
      boxWeightKg:    product.computedBoxWeightKg,
      stockPallets:   product.stockPallets,
      stockStatus:    product.stockStatus,
      isEco:          product.isEco,
      isNew:          product.isNew,
      isHit:          product.isHit,
      certifications: product.certifications ?? [],
      images:         product.images ?? [],
    };
  }

  /** Localise I18nString с fallback-цепочкой: запрошенный → en → ru → '' */
  private localise(field: Record<string, string> | null | undefined, lang: string): string {
    if (!field) return '';
    return field[lang] || field['en'] || field['ru'] || field['pl'] || '';
  }

  async addImages(id: number, urls: string[]): Promise<Product> {
    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Продукт #${id} не найден`);
    product.images = [...(product.images ?? []), ...urls];
    return this.repo.save(product);
  }

  /**
   * Получить сырые I18n данные товара — для формы редактирования в admin-панели.
   */
  async adminGetRaw(id: number): Promise<Product> {
    const product = await this.repo.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Продукт #${id} не найден`);
    return product;
  }

}