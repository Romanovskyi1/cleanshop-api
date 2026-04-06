"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ProductsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const product_entity_1 = require("./entities/product.entity");
let ProductsService = ProductsService_1 = class ProductsService {
    constructor(repo) {
        this.repo = repo;
        this.logger = new common_1.Logger(ProductsService_1.name);
    }
    async findAll(query) {
        const lang = query.lang ?? 'en';
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const qb = this.repo
            .createQueryBuilder('p')
            .where('p.is_active = true');
        if (query.search) {
            const term = `%${query.search.toLowerCase()}%`;
            qb.andWhere(`(
          LOWER(p.sku) LIKE :term
          OR LOWER(p.name->>'ru') LIKE :term
          OR LOWER(p.name->>'en') LIKE :term
          OR LOWER(p.name->>'de') LIKE :term
          OR LOWER(p.name->>'pl') LIKE :term
        )`, { term });
        }
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
        this.applySorting(qb, query.sort, lang);
        const total = await qb.getCount();
        qb.skip((page - 1) * limit).take(limit);
        const products = await qb.getMany();
        return {
            items: products.map(p => this.toListItem(p, lang)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async findOne(id, lang = 'en') {
        const product = await this.repo.findOne({
            where: { id, isActive: true },
        });
        if (!product)
            throw new common_1.NotFoundException(`Продукт #${id} не найден`);
        return {
            ...this.toListItem(product, lang),
            description: this.localise(product.description, lang),
            palletsPerTruck: product.palletsPerTruck,
            palletPriceEur: product.palletPriceEur,
            palletWeightKg: Number(product.palletWeightKg) || product.computedBoxWeightKg * product.boxesPerPallet,
        };
    }
    async findBySku(sku) {
        const product = await this.repo.findOne({ where: { sku } });
        if (!product)
            throw new common_1.NotFoundException(`Продукт со SKU "${sku}" не найден`);
        return product;
    }
    async getPalletData(productId) {
        const p = await this.repo.findOne({
            where: { id: productId, isActive: true },
            select: ['id', 'priceEur', 'unitsPerBox', 'boxesPerPallet', 'boxWeightKg', 'weightKg'],
        });
        if (!p)
            throw new common_1.NotFoundException(`Продукт #${productId} не найден`);
        return {
            priceEur: Number(p.priceEur),
            unitsPerBox: p.unitsPerBox,
            boxesPerPallet: p.boxesPerPallet,
            boxWeightKg: p.computedBoxWeightKg,
        };
    }
    async getCategories() {
        const rows = await this.repo
            .createQueryBuilder('p')
            .select('p.category', 'category')
            .addSelect('COUNT(*)', 'count')
            .where('p.is_active = true')
            .groupBy('p.category')
            .orderBy('count', 'DESC')
            .getRawMany();
        return rows.map(r => ({ category: r.category, count: Number(r.count) }));
    }
    async adminCreate(dto) {
        const existing = await this.repo.findOne({ where: { sku: dto.sku } });
        if (existing) {
            throw new common_1.ConflictException(`Продукт со SKU "${dto.sku}" уже существует`);
        }
        const product = this.repo.create(dto);
        const saved = await this.repo.save(product);
        this.logger.log(`Создан продукт SKU=${saved.sku} id=${saved.id}`);
        return saved;
    }
    async adminUpdate(id, dto) {
        const product = await this.repo.findOne({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException(`Продукт #${id} не найден`);
        Object.assign(product, dto);
        return this.repo.save(product);
    }
    async updateStock(id, stockPallets) {
        await this.repo.update(id, { stockPallets });
        this.logger.log(`Stock updated: product #${id} → ${stockPallets} паллет`);
    }
    async adminRemove(id) {
        await this.repo.update(id, { isActive: false });
        this.logger.log(`Продукт #${id} скрыт из каталога`);
    }
    applySorting(qb, sort, lang) {
        switch (sort) {
            case 'price_asc':
                qb.orderBy('p.price_eur', 'ASC');
                break;
            case 'price_desc':
                qb.orderBy('p.price_eur', 'DESC');
                break;
            case 'name_asc':
                qb.orderBy(`p.name->>'${lang}'`, 'ASC', 'NULLS LAST');
                break;
            case 'stock':
                qb.orderBy('p.stock_pallets', 'DESC');
                break;
            case 'popularity':
            default:
                qb.orderBy('p.is_hit', 'DESC')
                    .addOrderBy('p.is_new', 'DESC')
                    .addOrderBy('p.id', 'ASC');
                break;
        }
    }
    toListItem(product, lang) {
        return {
            id: product.id,
            sku: product.sku,
            name: this.localise(product.name, lang),
            description: this.localise(product.description, lang),
            category: product.category,
            volumeL: Number(product.volumeL) || null,
            priceEur: Number(product.priceEur),
            boxPriceEur: product.boxPriceEur,
            palletPriceEur: product.palletPriceEur,
            unitsPerBox: product.unitsPerBox,
            boxesPerPallet: product.boxesPerPallet,
            boxWeightKg: product.computedBoxWeightKg,
            stockPallets: product.stockPallets,
            stockStatus: product.stockStatus,
            isEco: product.isEco,
            isNew: product.isNew,
            isHit: product.isHit,
            certifications: product.certifications ?? [],
            images: product.images ?? [],
        };
    }
    localise(field, lang) {
        if (!field)
            return '';
        return field[lang] ?? field['en'] ?? field['ru'] ?? '';
    }
    async addImages(id, urls) {
        const product = await this.repo.findOne({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException(`Продукт #${id} не найден`);
        product.images = [...(product.images ?? []), ...urls];
        return this.repo.save(product);
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = ProductsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProductsService);
//# sourceMappingURL=products.service.js.map