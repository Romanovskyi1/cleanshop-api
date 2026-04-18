import {
  Injectable, NotFoundException, BadRequestException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, QueryFailedError } from 'typeorm';

import { Pallet, PalletStatus }              from './entities/pallet.entity';
import { Product }                           from '../products/entities/product.entity';
import { Truck }                             from '../orders/entities/truck.entity';
import { Order, TruckType }                  from '../orders/entities/order.entity';
import {
  CreatePalletDto, UpdatePalletDto,
  AddPalletsDto, AssignPalletsToTruckDto, PalletQueryDto,
} from './dto/pallet.dto';

// Лимиты транспорта — физика, не продукта.
const TRUCK_LIMITS: Record<TruckType, { maxPallets: number; maxWeightKg: number }> = {
  [TruckType.SMALL_5T]:  { maxPallets: 12, maxWeightKg: 5_000  },
  [TruckType.LARGE_24T]: { maxPallets: 33, maxWeightKg: 24_000 },
};

interface ProductPhysics {
  palletWeightKg: number;
  boxesPerPallet: number;
}

@Injectable()
export class PalletsService {
  private readonly logger = new Logger(PalletsService.name);

  constructor(
    @InjectRepository(Pallet)
    private readonly pallets: Repository<Pallet>,

    @InjectRepository(Truck)
    private readonly trucks: Repository<Truck>,

    @InjectRepository(Order)
    private readonly orders: Repository<Order>,

    @InjectRepository(Product)
    private readonly products: Repository<Product>,

    private readonly ds: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // ПАЛЛЕТЫ — CRUD
  // ══════════════════════════════════════════════════════════════════════

  async findAll(companyId: number, query: PalletQueryDto): Promise<Pallet[]> {
    const qb = this.pallets
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.product', 'product')
      .where('p.company_id = :companyId', { companyId })
      .orderBy('p.created_at', 'ASC');

    if (query.orderId) qb.andWhere('p.order_id = :orderId', { orderId: query.orderId });
    if (query.status)  qb.andWhere('p.status   = :status',  { status:  query.status });

    return qb.getMany();
  }

  async findOne(id: number, companyId: number): Promise<Pallet> {
    const pallet = await this.pallets.findOne({
      where: { id, companyId },
      relations: ['product'],
    });
    if (!pallet) throw new NotFoundException(`Паллета #${id} не найдена`);
    return pallet;
  }

  /**
   * Низкоуровневое создание паллеты (без авто-консолидации).
   * Для продакшн-флоу используй addPallets().
   */
  async create(companyId: number, dto: CreatePalletDto): Promise<Pallet> {
    const product = await this.products.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException(`Товар #${dto.productId} не найден`);
    this.assertProductPhysics(product);

    const pallet = this.pallets.create({
      companyId,
      orderId:      dto.orderId ?? null,
      name:         dto.name    ?? '',
      productId:    dto.productId,
      palletsCount: dto.palletsCount ?? 1,
      status:       PalletStatus.BUILDING,
      isLegacy:     false,
    });
    return this.pallets.save(pallet);
  }

  /**
   * Обновить паллету (имя, фуру, количество паллет).
   * palletsCount === 0 → удалить (возврат null).
   */
  async update(id: number, companyId: number, dto: UpdatePalletDto): Promise<Pallet | null> {
    if (dto.palletsCount !== undefined) {
      const result = await this.updatePalletsCount(id, companyId, dto.palletsCount);
      if (!result) return null; // удалена
      if (dto.name !== undefined)    result.name = dto.name ?? '';
      if (dto.truckId !== undefined) {
        this.assertEditableForContentChange(result);
        await this.assignToTruck(result, dto.truckId);
      }
      return this.pallets.save(result);
    }

    const pallet = await this.findOne(id, companyId);

    // Для legacy разрешаем смену truck/name, но не редактирование "контента".
    if (dto.name !== undefined)    pallet.name = dto.name ?? '';
    if (dto.truckId !== undefined) await this.assignToTruck(pallet, dto.truckId);
    return this.pallets.save(pallet);
  }

  async remove(id: number, companyId: number): Promise<void> {
    const pallet = await this.findOne(id, companyId);
    this.assertEditableForContentChange(pallet);
    await this.pallets.remove(pallet);
    this.logger.log(`Удалена паллета #${id} компании ${companyId}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // ДОМЕННЫЙ ВХОД: добавить N паллет SKU в заказ
  // ══════════════════════════════════════════════════════════════════════

  async addPallets(
    orderId: number,
    companyId: number,
    dto: AddPalletsDto,
    idempotencyKey?: string,
  ): Promise<Pallet> {
    try {
      return await this.ds.transaction(async (em: EntityManager) => {
        // 1. Идемпотентность на уровне (orderId, idempotencyKey)
        if (idempotencyKey) {
          const existing = await em.findOne(Pallet, {
            where: { orderId, idempotencyKey, companyId },
            relations: ['product'],
          });
          if (existing) return existing;
        }

        // 2. Lock заказа (сериализуем конкурентные добавления)
        const order = await em.findOne(Order, {
          where: { id: orderId, companyId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!order) throw new NotFoundException(`Заказ #${orderId} не найден`);

        // 3. Продукт и его физика
        const product = await em.findOne(Product, { where: { id: dto.productId } });
        if (!product) throw new NotFoundException(`Товар #${dto.productId} не найден`);
        this.assertProductPhysics(product);

        const physics: ProductPhysics = {
          palletWeightKg: Number(product.palletWeightKg),
          boxesPerPallet: product.boxesPerPallet,
        };

        // 4. Валидация лимитов фуры ДО изменений
        if (order.truckType) {
          await this.validateTruckLimits(em, orderId, order.truckType, product.id, dto.palletsCount, physics);
        }

        // 5. Консолидация: ищем редактируемую non-legacy паллету того же SKU
        const existing = await em.findOne(Pallet, {
          where: {
            orderId,
            companyId,
            productId: dto.productId,
            isLegacy: false,
            status: PalletStatus.BUILDING,
          },
          relations: ['product'],
        });

        if (existing) {
          existing.palletsCount = existing.palletsCount + dto.palletsCount;
          if (idempotencyKey && !existing.idempotencyKey) {
            existing.idempotencyKey = idempotencyKey;
          }
          return em.save(Pallet, existing);
        }

        // 6. Создаём новую
        const fresh = em.create(Pallet, {
          companyId,
          orderId,
          productId: dto.productId,
          palletsCount: dto.palletsCount,
          name: '',
          status: PalletStatus.BUILDING,
          isLegacy: false,
          idempotencyKey: idempotencyKey ?? null,
        });
        const saved = await em.save(Pallet, fresh);
        // Переподтягиваем с product для корректных computed getters в ответе
        const withProduct = await em.findOne(Pallet, { where: { id: saved.id }, relations: ['product'] });
        return withProduct ?? saved;
      });
    } catch (err) {
      // Идемпотентность через partial unique index: при гонке два запроса
      // с одним ключом — второй получит 23505 и должен вернуть существующую запись.
      if (err instanceof QueryFailedError && (err as QueryFailedError & { code?: string }).code === '23505' && idempotencyKey) {
        const existing = await this.pallets.findOne({
          where: { orderId, idempotencyKey, companyId },
          relations: ['product'],
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  /**
   * Установить точное количество паллет (SET-семантика).
   * 0 → удалить.
   */
  async updatePalletsCount(
    palletId: number,
    companyId: number,
    newCount: number,
  ): Promise<Pallet | null> {
    return this.ds.transaction(async (em: EntityManager) => {
      const pallet = await em.findOne(Pallet, {
        where: { id: palletId, companyId },
        relations: ['product'],
      });
      if (!pallet) throw new NotFoundException(`Паллета #${palletId} не найдена`);
      this.assertEditableForContentChange(pallet);

      if (newCount === 0) {
        await em.remove(Pallet, pallet);
        return null;
      }

      const delta = newCount - pallet.palletsCount;
      if (delta > 0 && pallet.orderId) {
        const order = await em.findOne(Order, { where: { id: pallet.orderId } });
        if (order?.truckType) {
          await this.validateTruckLimits(
            em, pallet.orderId, order.truckType,
            pallet.productId, delta,
            { palletWeightKg: Number(pallet.product.palletWeightKg), boxesPerPallet: pallet.product.boxesPerPallet },
            pallet.id,
          );
        }
      }

      pallet.palletsCount = newCount;
      return em.save(Pallet, pallet);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ПЛАНИРОВЩИК ФУР
  // ══════════════════════════════════════════════════════════════════════

  async assignPalletsToTruck(
    truckId: number,
    orderId: number,
    companyId: number,
    dto: AssignPalletsToTruckDto,
  ): Promise<{ truck: Truck; pallets: Pallet[] }> {
    return this.ds.transaction(async (em: EntityManager) => {
      const truck = await em.findOne(Truck, {
        where: { id: truckId, orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!truck) throw new NotFoundException(`Фура #${truckId} не найдена`);

      await em.update(
        Pallet,
        { truckId, companyId },
        { truckId: null, status: PalletStatus.READY },
      );

      if (dto.palletIds.length === 0) {
        return { truck, pallets: [] };
      }

      const pallets = await em.find(Pallet, {
        where: dto.palletIds.map(pid => ({ id: pid, companyId })),
        relations: ['product'],
      });

      if (pallets.length !== dto.palletIds.length) {
        throw new BadRequestException(
          'Некоторые паллеты не найдены или принадлежат другой компании',
        );
      }

      const locked = pallets.filter(p => p.status === PalletStatus.LOCKED);
      if (locked.length) {
        throw new ForbiddenException(
          `Паллеты [${locked.map(p => p.id).join(',')}] заблокированы`,
        );
      }

      const totalPalletSlots = pallets.reduce((s, p) => s + p.palletsCount, 0);
      const totalWeight      = pallets.reduce((s, p) => s + p.totalWeightKg, 0);

      if (totalPalletSlots > truck.maxPallets) {
        throw new BadRequestException(
          `Фура вмещает ${truck.maxPallets} паллет, запрошено ${totalPalletSlots}`,
        );
      }
      if (totalWeight > Number(truck.maxWeightKg)) {
        throw new BadRequestException(
          `Превышен вес фуры: ${totalWeight.toFixed(0)} кг > ${truck.maxWeightKg} кг`,
        );
      }

      for (const pallet of pallets) {
        pallet.truckId = truckId;
        pallet.orderId = orderId;
        pallet.status  = PalletStatus.ASSIGNED;
      }
      await em.save(Pallet, pallets);

      this.logger.log(
        `Фура #${truckId}: назначено ${totalPalletSlots} пал., ${totalWeight.toFixed(0)} кг`,
      );

      return { truck, pallets };
    });
  }

  async removePalletFromTruck(palletId: number, companyId: number): Promise<Pallet> {
    const pallet = await this.findOne(palletId, companyId);

    if (pallet.status === PalletStatus.LOCKED) {
      throw new ForbiddenException('Паллета заблокирована — окно редактирования закрыто');
    }

    pallet.truckId = null;
    pallet.status  = PalletStatus.READY;
    return this.pallets.save(pallet);
  }

  async getTrucksSummary(
    orderId: number,
    companyId: number,
  ): Promise<Array<{
    truck:         Truck;
    pallets:       Pallet[];
    palletCount:   number;
    totalWeightKg: number;
    palletFillPct: number;
    weightFillPct: number;
  }>> {
    const trucks = await this.trucks.find({ where: { orderId }, order: { number: 'ASC' } });

    const allPallets = await this.pallets.find({
      where: { orderId, companyId },
      relations: ['product'],
    });

    return trucks.map(truck => {
      const pallets       = allPallets.filter(p => p.truckId === truck.id);
      const palletCount   = pallets.reduce((s, p) => s + p.palletsCount, 0);
      const totalWeightKg = pallets.reduce((s, p) => s + p.totalWeightKg, 0);

      return {
        truck,
        pallets,
        palletCount,
        totalWeightKg,
        palletFillPct: Math.round((palletCount   / truck.maxPallets) * 100),
        weightFillPct: Math.round((totalWeightKg / Number(truck.maxWeightKg)) * 100),
      };
    });
  }

  async getUnassigned(orderId: number, companyId: number): Promise<Pallet[]> {
    return this.pallets.find({
      where: { orderId, companyId, truckId: null },
      relations: ['product'],
      order: { createdAt: 'ASC' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // БЛОКИРОВКА (при закрытии окна)
  // ══════════════════════════════════════════════════════════════════════

  async lockAll(orderId: number, companyId: number): Promise<{ locked: number; autoAssigned: number }> {
    return this.ds.transaction(async (em: EntityManager) => {
      const unassigned = await em.find(Pallet, {
        where: { orderId, companyId, truckId: null },
        relations: ['product'],
      });

      let autoAssigned = 0;
      if (unassigned.length > 0) {
        autoAssigned = await this.autoDistribute(em, orderId, unassigned);
      }

      const { affected } = await em.update(
        Pallet,
        { orderId, companyId },
        { status: PalletStatus.LOCKED },
      );

      this.logger.log(
        `Заказ #${orderId}: заблокировано ${affected} паллет, авто-назначено ${autoAssigned}`,
      );

      return { locked: affected ?? 0, autoAssigned };
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Проверка лимитов фуры с учётом добавляемых паллет SKU.
   * `excludePalletId` — при апдейте исключаем самих себя из текущей суммы.
   */
  private async validateTruckLimits(
    em: EntityManager,
    orderId: number,
    truckType: TruckType,
    productId: number,
    addingPallets: number,
    physics: ProductPhysics,
    excludePalletId?: number,
  ): Promise<void> {
    const limits = TRUCK_LIMITS[truckType];

    const orderPallets = await em.find(Pallet, {
      where: { orderId },
      relations: ['product'],
    });

    const currentSlots = orderPallets
      .filter(p => p.id !== excludePalletId)
      .reduce((s, p) => s + p.palletsCount, 0);
    const currentWeight = orderPallets
      .filter(p => p.id !== excludePalletId)
      .reduce((s, p) => s + p.totalWeightKg, 0);

    // Для SET-операции addingPallets может быть отрицательным — тогда это не нужно проверять.
    // Для ADD всегда положительное.
    const newSlots  = currentSlots  + addingPallets;
    const newWeight = currentWeight + addingPallets * physics.palletWeightKg;

    if (newSlots > limits.maxPallets) {
      throw new BadRequestException(
        `Превышен лимит паллет фуры ${truckType}: ${newSlots} > ${limits.maxPallets}`,
      );
    }
    if (newWeight > limits.maxWeightKg) {
      throw new BadRequestException(
        `Превышен лимит веса фуры ${truckType}: ${newWeight.toFixed(0)} кг > ${limits.maxWeightKg} кг`,
      );
    }

    // Неиспользуемая переменная productId нужна для будущих SKU-специфичных лимитов.
    // Сейчас лимит — общий по фуре, productId оставляем в сигнатуре для явности контракта.
    void productId;
  }

  private async autoDistribute(
    em: EntityManager,
    orderId: number,
    pallets: Pallet[],
  ): Promise<number> {
    const trucks = await em.find(Truck, { where: { orderId }, order: { number: 'ASC' } });
    if (!trucks.length) return 0;

    let assigned = 0;
    let ti = 0;

    const slots = await Promise.all(trucks.map(t => em.count(Pallet, { where: { truckId: t.id } })));

    for (const pallet of pallets) {
      while (ti < trucks.length && slots[ti] >= trucks[ti].maxPallets) ti++;
      if (ti >= trucks.length) break;

      pallet.truckId = trucks[ti].id;
      pallet.status  = PalletStatus.ASSIGNED;
      await em.save(Pallet, pallet);
      slots[ti]++;
      assigned++;
    }

    return assigned;
  }

  private assertEditableForContentChange(pallet: Pallet): void {
    if (!pallet.isEditable) {
      throw new ForbiddenException(
        `Паллета #${pallet.id} заблокирована (статус: ${pallet.status})`,
      );
    }
    if (pallet.isLegacy) {
      throw new ForbiddenException(
        `Паллета #${pallet.id} legacy — содержимое неизменяемо`,
      );
    }
  }

  private assertProductPhysics(product: Product): void {
    const pw = Number(product.palletWeightKg ?? 0);
    const bp = Number(product.boxesPerPallet ?? 0);
    if (!pw || !bp) {
      throw new BadRequestException(
        `SKU ${product.sku} без спецификации паллеты — заполните в каталоге`,
      );
    }
  }

  private async assignToTruck(pallet: Pallet, truckId: number | null): Promise<void> {
    if (truckId === null) {
      pallet.truckId = null;
      pallet.status  = PalletStatus.READY;
      return;
    }

    const truck = await this.trucks.findOne({ where: { id: truckId, orderId: pallet.orderId ?? undefined } });
    if (!truck) throw new NotFoundException(`Фура #${truckId} не найдена`);

    // Текущая сумма слотов в фуре (по palletsCount)
    const existing = await this.pallets.find({ where: { truckId }, relations: ['product'] });
    const currentSlots = existing
      .filter(p => p.id !== pallet.id)
      .reduce((s, p) => s + p.palletsCount, 0);

    if (currentSlots + pallet.palletsCount > truck.maxPallets) {
      throw new BadRequestException(
        `Фура #${truckId} не вмещает ${pallet.palletsCount} доп. паллет (${currentSlots}/${truck.maxPallets})`,
      );
    }

    pallet.truckId = truckId;
    pallet.status  = PalletStatus.ASSIGNED;
  }
}
