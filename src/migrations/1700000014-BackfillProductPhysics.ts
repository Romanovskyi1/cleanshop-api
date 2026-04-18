import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2.5: Backfill pallet_weight_kg для активных SKU и
 * деактивация SKU без физических данных.
 *
 * Значения получены от бизнеса: pallet_weight_kg = boxes_per_pallet × box_weight_kg.
 *
 * CHECK-инвариант: активный продукт обязан иметь pallet_weight_kg.
 * Inactive SKU исключены — для них физику можно ввести позже через admin UI (Phase 4).
 */
export class BackfillProductPhysics1700000014000 implements MigrationInterface {
  name = 'BackfillProductPhysics1700000014000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Backfill активных SKU ─────────────────────────────────────────
    await queryRunner.query(`UPDATE products SET pallet_weight_kg = 672.00 WHERE TRIM(sku) = 'AQ-115-1L'`);
    await queryRunner.query(`UPDATE products SET pallet_weight_kg = 576.00 WHERE TRIM(sku) = 'Dixan'`);
    await queryRunner.query(`UPDATE products SET pallet_weight_kg = 835.20 WHERE TRIM(sku) = '121'`);
    await queryRunner.query(`UPDATE products SET pallet_weight_kg = 648.00 WHERE TRIM(sku) = 'gel'`);

    // ── 2. Деактивация SKU без физических данных (не в админ-панели) ─────
    await queryRunner.query(`
      UPDATE products
         SET is_active = false
       WHERE sku IN ('GC-028-5L', 'CP-003-3K')
    `);

    // ── 3. Guard: все активные продукты должны иметь pallet_weight_kg ────
    await queryRunner.query(`
      ALTER TABLE products
        ADD CONSTRAINT chk_active_product_has_pallet_weight
        CHECK (is_active = false OR pallet_weight_kg IS NOT NULL)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        DROP CONSTRAINT IF EXISTS chk_active_product_has_pallet_weight
    `);

    // Восстанавливаем is_active — не знаем исходные значения, по умолчанию true
    await queryRunner.query(`
      UPDATE products SET is_active = true WHERE sku IN ('GC-028-5L', 'CP-003-3K')
    `);

    await queryRunner.query(`UPDATE products SET pallet_weight_kg = NULL WHERE sku IN ('AQ-115-1L', 'Dixan', '121', 'gel')`);
  }
}
