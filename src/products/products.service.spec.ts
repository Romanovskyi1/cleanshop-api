import { Test, TestingModule }  from '@nestjs/testing';
import { getRepositoryToken }   from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { ProductsService }  from './products.service';
import { Product, ProductCategory } from './entities/product.entity';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeProduct(overrides: Partial<Product> = {}): Product {
  return Object.assign(new Product(), {
    id:             1,
    sku:            'GC-028-5L',
    name:           { ru: 'Гель для посуды 5L', en: 'Dish Gel 5L', de: 'Geschirrspülmittel 5L' },
    description:    { ru: 'Описание', en: 'Description' },
    category:       ProductCategory.GEL,
    volumeL:        5,
    weightKg:       0.6,
    priceEur:       12.40,
    unitsPerBox:    24,
    boxesPerPallet: 40,
    palletsPerTruck: 33,
    palletWeightKg: 820,
    boxWeightKg:    14.5,
    stockPallets:   84,
    isEco:          true,
    certifications: ['EU Ecolabel'],
    images:         ['https://cdn.example.com/gc-028.jpg'],
    isActive:       true,
    isNew:          false,
    isHit:          true,
    createdAt:      new Date(),
    updatedAt:      new Date(),
    ...overrides,
  });
}

// ── Mock QueryBuilder chain ────────────────────────────────────────────────────
function makeQB(results: Product[] = [], count = 0) {
  return {
    where:         jest.fn().mockReturnThis(),
    andWhere:      jest.fn().mockReturnThis(),
    orderBy:       jest.fn().mockReturnThis(),
    addOrderBy:    jest.fn().mockReturnThis(),
    select:        jest.fn().mockReturnThis(),
    addSelect:     jest.fn().mockReturnThis(),
    skip:          jest.fn().mockReturnThis(),
    take:          jest.fn().mockReturnThis(),
    groupBy:       jest.fn().mockReturnThis(),
    getMany:       jest.fn().mockResolvedValue(results),
    getCount:      jest.fn().mockResolvedValue(count),
    getRawMany:    jest.fn().mockResolvedValue([]),
    getOne:        jest.fn().mockResolvedValue(results[0] ?? null),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('ProductsService', () => {
  let service: ProductsService;
  let repo: {
    findOne:            jest.Mock;
    find:               jest.Mock;
    create:             jest.Mock;
    save:               jest.Mock;
    update:             jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne:            jest.fn(),
      find:               jest.fn(),
      create:             jest.fn(),
      save:               jest.fn(),
      update:             jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repo },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAll ──────────────────────────────────────────────────────────────

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

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(p.sku) LIKE :term'),
        expect.objectContaining({ term: '%гель%' }),
      );
    });

    it('фильтрует по категории', async () => {
      const qb = makeQB([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ category: ProductCategory.GEL });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'p.category = :category',
        { category: ProductCategory.GEL },
      );
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
        name: { en: 'Dish Gel 5L' }, // нет pl
      });
      const qb = makeQB([product], 1);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ lang: 'pl' });
      expect(result.items[0].name).toBe('Dish Gel 5L');
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────

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
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getPalletData ────────────────────────────────────────────────────────

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
      // 0.6 кг × 24 шт в коробке = 14.4 кг
      expect(result.boxWeightKg).toBeCloseTo(14.4, 1);
    });

    it('возвращает дефолт 15 кг если вес не задан', async () => {
      const product = makeProduct({ boxWeightKg: null, weightKg: null });
      repo.findOne.mockResolvedValue(product);

      const result = await service.getPalletData(1);
      expect(result.boxWeightKg).toBe(15);
    });
  });

  // ── adminCreate ──────────────────────────────────────────────────────────

  describe('adminCreate', () => {
    const dto = {
      sku: 'NEW-001', name: { en: 'New Product' }, category: ProductCategory.GEL,
      priceEur: 10, unitsPerBox: 12, boxesPerPallet: 48,
    };

    it('создаёт новый продукт', async () => {
      repo.findOne.mockResolvedValue(null); // SKU не занят
      const created = makeProduct({ sku: 'NEW-001' });
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.adminCreate(dto as any);
      expect(result.sku).toBe('NEW-001');
    });

    it('выбрасывает ConflictException при дублировании SKU', async () => {
      repo.findOne.mockResolvedValue(makeProduct()); // SKU уже занят
      await expect(service.adminCreate(dto as any)).rejects.toThrow(ConflictException);
    });
  });

  // ── computed properties ──────────────────────────────────────────────────

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
      expect(p.getLocaleName('pl')).toBe('Dish Gel'); // нет pl → en
      expect(p.getLocaleName('en')).toBe('Dish Gel');
    });
  });
});
