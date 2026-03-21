import {
  Injectable, NotFoundException, BadRequestException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';

import { Pallet, PalletItem, PalletStatus } from './entities/pallet.entity';
import { Truck }                            from '../orders/entities/truck.entity';
import {
  CreatePalletDto, UpdatePalletDto,
  AddPalletItemDto, UpdatePalletItemDto,
  AssignPalletsToTruckDto, PalletQueryDto,
} from './dto/pallet.dto';

// Стандартные ограничения паллеты
const PALLET_MAX_BOXES       = 40;   // максимум коробок на паллете
const PALLET_MAX_WEIGHT_KG   = 1000; // кг

// Средний вес одной коробки (если у продукта нет точного веса)
const DEFAULT_BOX_WEIGHT_KG  = 15;

// Минимум коробок — кратность (будет браться из products.units_per_box,
// здесь как дефолт)
const DEFAULT_BOX_UNIT = 1;

@Injectable()
export class PalletsService {
  private readonly logger = new Logger(PalletsService.name);

  constructor(
    @InjectRepository(Pallet)
    private readonly pallets: Repository<Pallet>,

    @InjectRepository(PalletItem)
    private readonly items: Repository<PalletItem>,

    @InjectRepository(Truck)
    private readonly trucks: Repository<Truck>,

    private readonly ds: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // ПАЛЛЕТЫ — CRUD
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Получить все паллеты компании (опционально — фильтр по заказу/статусу).
   */
  async findAll(companyId: number, query: PalletQueryDto): Promise<Pallet[]> {
    const qb = this.pallets
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.items', 'items')
      .where('p.company_id = :companyId', { companyId })
      .orderBy('p.created_at', 'ASC');

    if (query.orderId) {
      qb.andWhere('p.order_id = :orderId', { orderId: query.orderId });
    }
    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    return qb.getMany();
  }

  /**
   * Получить одну паллету (проверка владельца).
   */
  async findOne(id: number, companyId: number): Promise<Pallet> {
    const pallet = await this.pallets.findOne({
      where: { id, companyId },
      relations: ['items'],
    });
    if (!pallet) throw new NotFoundException(`Паллета #${id} не найдена`);
    return pallet;
  }

  /**
   * Создать новую пустую паллету.
   */
  async create(companyId: number, dto: CreatePalletDto): Promise<Pallet> {
    const pallet = this.pallets.create({
      companyId,
      orderId: dto.orderId ?? null,
      name:    dto.name ?? null,
      status:  PalletStatus.BUILDING,
    });
    return this.pallets.save(pallet);
  }

  /**
   * Обновить паллету (имя, назначение в фуру).
   */
  async update(id: number, companyId: number, dto: UpdatePalletDto): Promise<Pallet> {
    const pallet = await this.findOne(id, companyId);
    this.assertEditable(pallet);

    if (dto.name !== undefined)    pallet.name    = dto.name;
    if (dto.truckId !== undefined) {
      await this.assignToTruck(pallet, dto.truckId);
    }

    return this.pallets.save(pallet);
  }

  /**
   * Удалить паллету (только если редактируемая).
   */
  async remove(id: number, companyId: number): Promise<void> {
    const pallet = await this.findOne(id, companyId);
    this.assertEditable(pallet);
    await this.pallets.remove(pallet);
    this.logger.log(`Удалена паллета #${id} компании ${companyId}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // ПОЗИЦИИ ПАЛЛЕТЫ — CRUD
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Добавить товар в паллету.
   * Если товар уже есть — увеличивает количество.
   * Проверяет вместимость и кратность.
   */
  async addItem(
    palletId: number,
    companyId: number,
    dto: AddPalletItemDto,
    productData: { priceEur: number; unitsPerBox: number; weightPerBoxKg?: number },
  ): Promise<PalletItem> {
    return this.ds.transaction(async (em: EntityManager) => {
      const pallet = await em.findOne(Pallet, {
        where: { id: palletId, companyId },
        relations: ['items'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!pallet) throw new NotFoundException(`Паллета #${palletId} не найдена`);
      this.assertEditable(pallet);

      // Проверка кратности
      if (dto.boxes % productData.unitsPerBox !== 0) {
        throw new BadRequestException(
          `Количество коробок должно быть кратно ${productData.unitsPerBox}`,
        );
      }

      // Проверка вместимости (коробки)
      const currentBoxes   = pallet.items.reduce((s, i) => s + i.boxes, 0);
      const existingItem   = pallet.items.find(i => i.productId === dto.productId);
      const existingBoxes  = existingItem?.boxes ?? 0;
      const newTotalBoxes  = currentBoxes - existingBoxes + dto.boxes;

      if (newTotalBoxes > PALLET_MAX_BOXES) {
        throw new BadRequestException(
          `Паллета переполнена: ${newTotalBoxes} кор. > максимум ${PALLET_MAX_BOXES} кор.`,
        );
      }

      // Проверка вместимости (вес)
      const boxWeightKg    = productData.weightPerBoxKg ?? DEFAULT_BOX_WEIGHT_KG;
      const currentWeight  = Number(pallet.totalWeightKg);
      const existingWeight = existingBoxes * boxWeightKg;
      const newWeight      = currentWeight - existingWeight + dto.boxes * boxWeightKg;

      if (newWeight > PALLET_MAX_WEIGHT_KG) {
        throw new BadRequestException(
          `Превышен максимальный вес паллеты: ${newWeight.toFixed(0)} кг > ${PALLET_MAX_WEIGHT_KG} кг`,
        );
      }

      // Сохраняем или обновляем позицию
      let item = existingItem;
      if (item) {
        item.boxes      = dto.boxes;
        item.priceEur   = productData.priceEur;
        item.subtotalEur = Number((productData.priceEur * dto.boxes).toFixed(2));
      } else {
        item = em.create(PalletItem, {
          palletId:    palletId,
          productId:   dto.productId,
          priceEur:    productData.priceEur,
          boxes:       dto.boxes,
          subtotalEur: Number((productData.priceEur * dto.boxes).toFixed(2)),
        });
      }
      await em.save(PalletItem, item);

      // Пересчитываем агрегаты паллеты
      await this.recalcPallet(em, palletId);

      // Обновляем статус если паллета непустая
      if (pallet.status === PalletStatus.BUILDING && newTotalBoxes > 0) {
        await em.update(Pallet, palletId, { status: PalletStatus.BUILDING });
      }

      return item;
    });
  }

  /**
   * Изменить количество коробок в позиции.
   */
  async updateItem(
    palletId: number,
    itemId: number,
    companyId: number,
    dto: UpdatePalletItemDto,
    productData: { priceEur: number; unitsPerBox: number; weightPerBoxKg?: number },
  ): Promise<PalletItem> {
    // Делегируем в addItem — он обработает и обновление тоже
    const item = await this.items.findOne({ where: { id: itemId, palletId } });
    if (!item) throw new NotFoundException(`Позиция #${itemId} не найдена`);

    return this.addItem(palletId, companyId, {
      productId: item.productId,
      boxes:     dto.boxes,
    }, productData);
  }

  /**
   * Удалить позицию из паллеты.
   */
  async removeItem(palletId: number, itemId: number, companyId: number): Promise<void> {
    return this.ds.transaction(async (em: EntityManager) => {
      const pallet = await em.findOne(Pallet, {
        where: { id: palletId, companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!pallet) throw new NotFoundException(`Паллета #${palletId} не найдена`);
      this.assertEditable(pallet);

      const item = await em.findOne(PalletItem, { where: { id: itemId, palletId } });
      if (!item) throw new NotFoundException(`Позиция #${itemId} не найдена`);

      await em.remove(PalletItem, item);
      await this.recalcPallet(em, palletId);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ПЛАНИРОВЩИК ФУР
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Назначить набор паллет в конкретную фуру.
   * Снимает предыдущее назначение и проставляет новое.
   * Проверяет вместимость фуры.
   */
  async assignPalletsToTruck(
    truckId: number,
    orderId: number,
    companyId: number,
    dto: AssignPalletsToTruckDto,
  ): Promise<{ truck: Truck; pallets: Pallet[] }> {
    return this.ds.transaction(async (em: EntityManager) => {
      // Загружаем фуру с блокировкой
      const truck = await em.findOne(Truck, {
        where: { id: truckId, orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!truck) throw new NotFoundException(`Фура #${truckId} не найдена`);

      // Снимаем старые назначения этой фуры
      await em.update(
        Pallet,
        { truckId, companyId },
        { truckId: null, status: PalletStatus.READY },
      );

      if (dto.palletIds.length === 0) {
        // Просто очистили фуру
        return { truck, pallets: [] };
      }

      // Загружаем запрошенные паллеты
      const pallets = await em.find(Pallet, {
        where: dto.palletIds.map(pid => ({ id: pid, companyId })),
        relations: ['items'],
      });

      if (pallets.length !== dto.palletIds.length) {
        throw new BadRequestException(
          'Некоторые паллеты не найдены или принадлежат другой компании',
        );
      }

      // Проверяем что паллеты редактируемые
      const locked = pallets.filter(p => p.status === PalletStatus.LOCKED);
      if (locked.length) {
        throw new ForbiddenException(
          `Паллеты [${locked.map(p => p.id).join(',')}] заблокированы`,
        );
      }

      // Считаем суммарные параметры
      const totalPallets = pallets.length;
      const totalWeight  = pallets.reduce((s, p) => s + Number(p.totalWeightKg), 0);

      if (totalPallets > truck.maxPallets) {
        throw new BadRequestException(
          `Фура вмещает ${truck.maxPallets} паллет, запрошено ${totalPallets}`,
        );
      }
      if (totalWeight > Number(truck.maxWeightKg)) {
        throw new BadRequestException(
          `Превышен вес фуры: ${totalWeight.toFixed(0)} кг > ${truck.maxWeightKg} кг`,
        );
      }

      // Назначаем паллеты
      for (const pallet of pallets) {
        pallet.truckId = truckId;
        pallet.orderId = orderId;
        pallet.status  = PalletStatus.ASSIGNED;
      }
      await em.save(Pallet, pallets);

      this.logger.log(
        `Фура #${truckId}: назначено ${totalPallets} пал., ${totalWeight.toFixed(0)} кг`,
      );

      return { truck, pallets };
    });
  }

  /**
   * Убрать паллету из фуры (переводит в статус READY).
   */
  async removePalletFromTruck(
    palletId: number,
    companyId: number,
  ): Promise<Pallet> {
    const pallet = await this.findOne(palletId, companyId);

    if (pallet.status === PalletStatus.LOCKED) {
      throw new ForbiddenException('Паллета заблокирована — окно редактирования закрыто');
    }

    pallet.truckId = null;
    pallet.status  = PalletStatus.READY;
    return this.pallets.save(pallet);
  }

  /**
   * Получить сводку по фурам заказа:
   * каждая фура + список назначенных паллет + % заполнения.
   */
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
    const trucks = await this.trucks.find({
      where: { orderId },
      order: { number: 'ASC' },
    });

    const allPallets = await this.pallets.find({
      where: { orderId, companyId },
      relations: ['items'],
    });

    return trucks.map(truck => {
      const pallets       = allPallets.filter(p => p.truckId === truck.id);
      const totalWeightKg = pallets.reduce((s, p) => s + Number(p.totalWeightKg), 0);

      return {
        truck,
        pallets,
        palletCount:   pallets.length,
        totalWeightKg,
        palletFillPct: Math.round((pallets.length / truck.maxPallets) * 100),
        weightFillPct: Math.round((totalWeightKg / Number(truck.maxWeightKg)) * 100),
      };
    });
  }

  /**
   * Получить нераспределённые паллеты заказа.
   */
  async getUnassigned(orderId: number, companyId: number): Promise<Pallet[]> {
    return this.pallets.find({
      where: { orderId, companyId, truckId: null },
      relations: ['items'],
      order: { createdAt: 'ASC' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // БЛОКИРОВКА (вызывается Cron-сервисом при закрытии окна)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Заблокировать все паллеты заказа.
   * Вызывается при закрытии окна редактирования (Cron / event).
   * Если есть нераспределённые — применяется авто-распределение.
   */
  async lockAll(orderId: number, companyId: number): Promise<{
    locked: number;
    autoAssigned: number;
  }> {
    return this.ds.transaction(async (em: EntityManager) => {
      const unassigned = await em.find(Pallet, {
        where: { orderId, companyId, truckId: null },
      });

      let autoAssigned = 0;

      // Авто-распределение по первой незаполненной фуре
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
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════

  /** Пересчитать агрегаты паллеты после изменения позиций. */
  private async recalcPallet(em: EntityManager, palletId: number): Promise<void> {
    const rows = await em
      .createQueryBuilder(PalletItem, 'i')
      .select('SUM(i.boxes)',        'totalBoxes')
      .addSelect('SUM(i.subtotal_eur)', 'totalAmountEur')
      .where('i.pallet_id = :palletId', { palletId })
      .getRawOne<{ totalBoxes: string; totalAmountEur: string }>();

    const totalBoxes      = Number(rows?.totalBoxes      ?? 0);
    const totalAmountEur  = Number(rows?.totalAmountEur  ?? 0);
    // Используем дефолтный вес на коробку — точный вес приходит из products
    const totalWeightKg   = totalBoxes * DEFAULT_BOX_WEIGHT_KG;

    await em.update(Pallet, palletId, { totalBoxes, totalWeightKg, totalAmountEur });
  }

  /** Авто-распределение нераспределённых паллет по фурам (равномерно по весу). */
  private async autoDistribute(
    em: EntityManager,
    orderId: number,
    pallets: Pallet[],
  ): Promise<number> {
    const trucks = await em.find(Truck, {
      where: { orderId },
      order: { number: 'ASC' },
    });
    if (!trucks.length) return 0;

    let assigned = 0;
    let ti = 0;

    // Считаем уже занятые слоты
    const slots = await Promise.all(trucks.map(t =>
      em.count(Pallet, { where: { truckId: t.id } })
    ));

    for (const pallet of pallets) {
      // Ищем первую незаполненную фуру
      while (ti < trucks.length && slots[ti] >= trucks[ti].maxPallets) ti++;
      if (ti >= trucks.length) break; // все фуры полны

      pallet.truckId = trucks[ti].id;
      pallet.status  = PalletStatus.ASSIGNED;
      await em.save(Pallet, pallet);
      slots[ti]++;
      assigned++;
    }

    return assigned;
  }

  /** Проверить что паллета доступна для редактирования. */
  private assertEditable(pallet: Pallet): void {
    if (!pallet.isEditable) {
      throw new ForbiddenException(
        `Паллета #${pallet.id} заблокирована (статус: ${pallet.status})`,
      );
    }
  }

  /** Назначить паллету в фуру — вызывается из update(). */
  private async assignToTruck(
    pallet: Pallet,
    truckId: number | null,
  ): Promise<void> {
    if (truckId === null) {
      pallet.truckId = null;
      pallet.status  = PalletStatus.READY;
      return;
    }

    const truck = await this.trucks.findOne({ where: { id: truckId } });
    if (!truck) throw new NotFoundException(`Фура #${truckId} не найдена`);

    const currentCount = await this.pallets.count({ where: { truckId } });
    if (currentCount >= truck.maxPallets) {
      throw new BadRequestException(
        `Фура #${truckId} заполнена (${currentCount}/${truck.maxPallets} паллет)`,
      );
    }

    pallet.truckId = truckId;
    pallet.status  = PalletStatus.ASSIGNED;
  }
}
