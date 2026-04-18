import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2: переход на моно-паллетную модель.
 *
 * 1 паллета = 1 SKU. Таблица pallet_items упраздняется, но в ЭТОЙ миграции
 * мы её НЕ удаляем — только переливаем данные и создаём backup. Удаление —
 * в отдельной миграции Phase 3, после того как production стабилизируется.
 *
 * Алгоритм переноса:
 *   — Одно-SKU паллеты: product_id = max product, pallets_count = ceil(total_boxes / boxes_per_pallet).
 *   — Mixed-SKU паллеты: is_legacy = true, product_id = SKU с наибольшим числом коробок.
 */
export class MigrateToMonoPallet1700000013000 implements MigrationInterface {
  name = 'MigrateToMonoPallet1700000013000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const ts = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // ── 1. Backup ─────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS pallets_backup_${ts} AS SELECT * FROM pallets`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS pallet_items_backup_${ts} AS SELECT * FROM pallet_items`);

    // ── 2. Отключаем триггер пересчёта на время миграции ─────────────────
    await queryRunner.query(`DROP TRIGGER IF EXISTS "pallet_items_recalc" ON "pallet_items"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "pallets_recalc_order" ON "pallets"`);

    // ── 3. Новые колонки (nullable на время перелива) ────────────────────
    await queryRunner.query(`
      ALTER TABLE "pallets"
        ADD COLUMN IF NOT EXISTS "product_id"      INTEGER REFERENCES "products"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "pallets"
        ADD COLUMN IF NOT EXISTS "pallets_count"   INTEGER NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "pallets"
        ADD COLUMN IF NOT EXISTS "is_legacy"       BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "pallets"
        ADD COLUMN IF NOT EXISTS "idempotency_key" UUID
    `);

    // ── 4. Partial unique index под идемпотентность на уровне заказа ─────
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "pallets_order_idem_uq"
        ON "pallets" ("order_id", "idempotency_key")
        WHERE "idempotency_key" IS NOT NULL
    `);

    // ── 5. Снимаем старый чек на вес (лимит теперь в продукте) ───────────
    await queryRunner.query(`ALTER TABLE "pallets" DROP CONSTRAINT IF EXISTS "chk_pallet_total_weight_max"`);

    // ── 6. Перенос данных — одно-SKU паллеты ─────────────────────────────
    await queryRunner.query(`
      WITH sku_per_pallet AS (
        SELECT pallet_id,
               COUNT(DISTINCT product_id) AS distinct_skus,
               MAX(product_id)            AS any_product_id,
               SUM(boxes)                 AS total_boxes
          FROM pallet_items
         GROUP BY pallet_id
      ),
      single_sku AS (
        SELECT s.pallet_id, s.any_product_id AS product_id, s.total_boxes
          FROM sku_per_pallet s
         WHERE s.distinct_skus = 1
      )
      UPDATE pallets p
         SET product_id    = ss.product_id,
             pallets_count = GREATEST(1, CEIL(ss.total_boxes::numeric / NULLIF(prod.boxes_per_pallet, 0)))::int,
             is_legacy     = false
        FROM single_sku ss
        JOIN products prod ON prod.id = ss.product_id
       WHERE p.id = ss.pallet_id
    `);

    // ── 7. Mixed-SKU паллеты → is_legacy ─────────────────────────────────
    await queryRunner.query(`
      WITH dominant AS (
        SELECT DISTINCT ON (pi.pallet_id)
               pi.pallet_id,
               pi.product_id,
               pi.boxes
          FROM pallet_items pi
          JOIN (
            SELECT pallet_id
              FROM pallet_items
             GROUP BY pallet_id
            HAVING COUNT(DISTINCT product_id) > 1
          ) mx ON mx.pallet_id = pi.pallet_id
         ORDER BY pi.pallet_id, pi.boxes DESC
      )
      UPDATE pallets p
         SET product_id    = d.product_id,
             pallets_count = 1,
             is_legacy     = true
        FROM dominant d
       WHERE p.id = d.pallet_id
    `);

    // ── 8. Паллеты без items (пустые) — удаляем, т.к. в новой модели
    //      не существует паллеты без SKU. Их никто не использует.
    await queryRunner.query(`
      DELETE FROM pallets
       WHERE product_id IS NULL
    `);

    // ── 9. product_id СТАНОВИТСЯ NOT NULL — ключевой инвариант модели.
    //      Если есть паллеты без product_id после шага 8 — миграция упадёт,
    //      что и требуется (явный сигнал на ручной разбор).
    await queryRunner.query(`
      ALTER TABLE "pallets" ALTER COLUMN "product_id" SET NOT NULL
    `);

    // ── 10. Дроп зависимой view v_truck_summary (использует total_weight_kg
    //       и total_amount_eur). Пересоздаём её ниже в новой форме.
    await queryRunner.query(`DROP VIEW IF EXISTS "v_truck_summary"`);

    // ── 10b. Дроп старых хранимых агрегатов pallet-уровня.
    //       Они теперь computed в entity. Для order-агрегатов оставляем как есть
    //       (заполняются иным способом при необходимости).
    await queryRunner.query(`ALTER TABLE "pallets" DROP COLUMN IF EXISTS "total_boxes"`);
    await queryRunner.query(`ALTER TABLE "pallets" DROP COLUMN IF EXISTS "total_weight_kg"`);
    await queryRunner.query(`ALTER TABLE "pallets" DROP COLUMN IF EXISTS "total_amount_eur"`);

    // ── 10c. Пересоздаём v_truck_summary через JOIN products.
    //       Вес = pallets_count * products.pallet_weight_kg.
    //       Сумма = pallets_count * products.boxes_per_pallet * products.price_eur.
    await queryRunner.query(`
      CREATE VIEW "v_truck_summary" AS
      SELECT
        t.id                                        AS truck_id,
        t.order_id,
        t.number                                    AS truck_number,
        t.max_pallets,
        t.max_weight_kg,
        COALESCE(SUM(p.pallets_count), 0)           AS pallet_count,
        COALESCE(SUM(p.pallets_count * prod.pallet_weight_kg), 0) AS total_weight_kg,
        COALESCE(SUM(p.pallets_count * prod.boxes_per_pallet * prod.price_eur), 0) AS total_amount_eur,
        ROUND(
          COALESCE(SUM(p.pallets_count), 0)::numeric / NULLIF(t.max_pallets, 0) * 100, 1
        )                                           AS pallet_fill_pct,
        ROUND(
          COALESCE(SUM(p.pallets_count * prod.pallet_weight_kg), 0)
            / NULLIF(t.max_weight_kg::numeric, 0) * 100, 1
        )                                           AS weight_fill_pct
      FROM trucks t
      LEFT JOIN pallets  p    ON p.truck_id   = t.id
      LEFT JOIN products prod ON prod.id      = p.product_id
      GROUP BY t.id, t.order_id, t.number, t.max_pallets, t.max_weight_kg
    `);

    // ── 11. Дроп старой функции пересчёта pallet-уровня.
    //       Order-уровень recalc_order_totals ломается (читает total_weight_kg из pallets).
    //       Удаляем его тоже — в новой модели не используется, агрегаты идут через JOIN product.
    await queryRunner.query(`DROP FUNCTION IF EXISTS recalc_pallet_totals() CASCADE`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS recalc_order_totals() CASCADE`);

    // NB: pallet_items ОСТАЁТСЯ как историческая таблица (read-only) —
    // её DROP в отдельной миграции Phase 3.
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Down восстанавливает структуру, НО НЕ ПЕРЕЗАЛИВАЕТ ДАННЫЕ из backup
    // (это ручная операция — backup-таблицы остаются рядом).
    await queryRunner.query(`DROP INDEX IF EXISTS "pallets_order_idem_uq"`);

    await queryRunner.query(`ALTER TABLE "pallets" ALTER COLUMN "product_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "pallets" DROP COLUMN IF EXISTS "idempotency_key"`);
    await queryRunner.query(`ALTER TABLE "pallets" DROP COLUMN IF EXISTS "is_legacy"`);
    await queryRunner.query(`ALTER TABLE "pallets" DROP COLUMN IF EXISTS "pallets_count"`);
    await queryRunner.query(`ALTER TABLE "pallets" DROP COLUMN IF EXISTS "product_id"`);

    // Восстановим хранимые агрегаты с дефолтами 0.
    await queryRunner.query(`
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "total_boxes"      INTEGER       NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "total_weight_kg"  DECIMAL(10,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "pallets" ADD COLUMN IF NOT EXISTS "total_amount_eur" DECIMAL(14,2) NOT NULL DEFAULT 0
    `);
  }
}
