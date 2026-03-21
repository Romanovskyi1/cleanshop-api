"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const products_service_1 = require("./products.service");
const product_entity_1 = require("./entities/product.entity");
function makeProduct(overrides = {}) {
    return Object.assign(new product_entity_1.Product(), {
        id: 1,
        sku: 'GC-028-5L',
        name: { ru: 'Гель для посуды 5L', en: 'Dish Gel 5L', de: 'Geschirrspülmittel 5L' },
        description: { ru: 'Описание', en: 'Description' },
        category: product_entity_1.ProductCategory.GEL,
        volumeL: 5,
        weightKg: 0.6,
        priceEur: 12.40,
        unitsPerBox: 24,
        boxesPerPallet: 40,
        palletsPerTruck: 33,
        palletWeightKg: 820,
        boxWeightKg: 14.5,
        stockPallets: 84,
        isEco: true,
        certifications: ['EU Ecolabel'],
        images: ['https://cdn.example.com/gc-028.jpg'],
        isActive: true,
        isNew: false,
        isHit: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    });
}
function makeQB(results = [], count = 0) {
    return {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(results),
        getCount: jest.fn().mockResolvedValue(count),
        getRawMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(results[0] ?? null),
    };
}
describe('ProductsService', () => {
    let service;
    let repo;
    beforeEach(async () => {
        repo = {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                products_service_1.ProductsService,
                { provide: (0, typeorm_1.getRepositoryToken)(product_entity_1.Product), useValue: repo },
            ],
        }).compile();
        service = module.get(products_service_1.ProductsService);
    });
    afterEach(() => jest.clearAllMocks());
    describe('findAll', () => {
        it('возвращает пагинированный список с дефолтами', async () => {
            const product = makeProduct();
            const qb = makeQB([product], 1);
            repo.createQueryBuilder.mockReturnValue(qb);
            const result = await service.findAll({ page: 1, limit: 20 });
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.totalPages).toBe(1);
            expect(result.items[0].sku).toBe('GC-028-5L');
        });
        it('применяет поиск по названию', async () => {
            const qb = makeQB([], 0);
            repo.createQueryBuilder.mockReturnValue(qb);
            await service.findAll({ search: 'гель' });
            expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('LOWER(p.sku) LIKE :term'), expect.objectContaining({ term: '%гель%' }));
        });
        it('фильтрует по категории', async () => {
            const qb = makeQB([], 0);
            repo.createQueryBuilder.mockReturnValue(qb);
            await service.findAll({ category: product_entity_1.ProductCategory.GEL });
            expect(qb.andWhere).toHaveBeenCalledWith('p.category = :category', { category: product_entity_1.ProductCategory.GEL });
        });
        it('фильтрует только ЭКО-товары', async () => {
            const qb = makeQB([], 0);
            repo.createQueryBuilder.mockReturnValue(qb);
            await service.findAll({ isEco: true });
            expect(qb.andWhere).toHaveBeenCalledWith('p.is_eco = true');
        });
        it('фильтрует товары в наличии', async () => {
            const qb = makeQB([], 0);
            repo.createQueryBuilder.mockReturnValue(qb);
            await service.findAll({ inStock: true });
            expect(qb.andWhere).toHaveBeenCalledWith('p.stock_pallets > 0');
        });
        it('локализует название на немецкий', async () => {
            const product = makeProduct();
            const qb = makeQB([product], 1);
            repo.createQueryBuilder.mockReturnValue(qb);
            const result = await service.findAll({ lang: 'de' });
            expect(result.items[0].name).toBe('Geschirrspülmittel 5L');
        });
        it('fallback на английский если язык отсутствует', async () => {
            const product = makeProduct({
                name: { en: 'Dish Gel 5L' },
            });
            const qb = makeQB([product], 1);
            repo.createQueryBuilder.mockReturnValue(qb);
            const result = await service.findAll({ lang: 'pl' });
            expect(result.items[0].name).toBe('Dish Gel 5L');
        });
    });
    describe('findOne', () => {
        it('возвращает полную карточку продукта', async () => {
            repo.findOne.mockResolvedValue(makeProduct());
            const result = await service.findOne(1, 'en');
            expect(result.id).toBe(1);
            expect(result.sku).toBe('GC-028-5L');
            expect(result.palletsPerTruck).toBe(33);
            expect(result.palletPriceEur).toBeGreaterThan(0);
        });
        it('выбрасывает NotFoundException для неактивного продукта', async () => {
            repo.findOne.mockResolvedValue(null);
            await expect(service.findOne(999)).rejects.toThrow(common_1.NotFoundException);
        });
    });
    describe('getPalletData', () => {
        it('возвращает данные для паллеты', async () => {
            repo.findOne.mockResolvedValue(makeProduct());
            const result = await service.getPalletData(1);
            expect(result.priceEur).toBe(12.40);
            expect(result.unitsPerBox).toBe(24);
            expect(result.boxesPerPallet).toBe(40);
            expect(result.boxWeightKg).toBe(14.5);
        });
        it('вычисляет boxWeightKg из weightKg если не задан', async () => {
            const product = makeProduct({ boxWeightKg: null, weightKg: 0.6 });
            repo.findOne.mockResolvedValue(product);
            const result = await service.getPalletData(1);
            expect(result.boxWeightKg).toBeCloseTo(14.4, 1);
        });
        it('возвращает дефолт 15 кг если вес не задан', async () => {
            const product = makeProduct({ boxWeightKg: null, weightKg: null });
            repo.findOne.mockResolvedValue(product);
            const result = await service.getPalletData(1);
            expect(result.boxWeightKg).toBe(15);
        });
    });
    describe('adminCreate', () => {
        const dto = {
            sku: 'NEW-001', name: { en: 'New Product' }, category: product_entity_1.ProductCategory.GEL,
            priceEur: 10, unitsPerBox: 12, boxesPerPallet: 48,
        };
        it('создаёт новый продукт', async () => {
            repo.findOne.mockResolvedValue(null);
            const created = makeProduct({ sku: 'NEW-001' });
            repo.create.mockReturnValue(created);
            repo.save.mockResolvedValue(created);
            const result = await service.adminCreate(dto);
            expect(result.sku).toBe('NEW-001');
        });
        it('выбрасывает ConflictException при дублировании SKU', async () => {
            repo.findOne.mockResolvedValue(makeProduct());
            await expect(service.adminCreate(dto)).rejects.toThrow(common_1.ConflictException);
        });
    });
    describe('Product entity computed', () => {
        it('вычисляет boxPriceEur корректно', () => {
            const p = makeProduct({ priceEur: 12.40, unitsPerBox: 24 });
            expect(p.boxPriceEur).toBe(297.60);
        });
        it('вычисляет palletPriceEur корректно', () => {
            const p = makeProduct({ priceEur: 12.40, unitsPerBox: 24, boxesPerPallet: 40 });
            expect(p.palletPriceEur).toBe(11904.00);
        });
        it('stockStatus = ok при остатке ≥ 10', () => {
            expect(makeProduct({ stockPallets: 84 }).stockStatus).toBe('ok');
        });
        it('stockStatus = low при остатке < 10', () => {
            expect(makeProduct({ stockPallets: 7 }).stockStatus).toBe('low');
        });
        it('stockStatus = out при остатке = 0', () => {
            expect(makeProduct({ stockPallets: 0 }).stockStatus).toBe('out');
        });
        it('getLocaleName с fallback-цепочкой', () => {
            const p = makeProduct({ name: { en: 'Dish Gel' } });
            expect(p.getLocaleName('pl')).toBe('Dish Gel');
            expect(p.getLocaleName('en')).toBe('Dish Gel');
        });
    });
});
//# sourceMappingURL=products.service.spec.js.map