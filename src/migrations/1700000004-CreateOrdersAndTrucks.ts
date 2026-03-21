import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Миграция 004: orders (погрузки) + trucks (фуры)
 *
 * Жизненный цикл заказа:
 *   draft → negotiating → confirmed → building → locked → shipped → cancelled
 *
 * draft       — заказ создан, дата ещё не предложена
 * negotiating — клиент или производитель предложил дату, ждём согласования
 * confirmed   — обе стороны согласовали дату
 * building    — окно сборки паллет открыто (за 5 дней до погрузки)
 * locked      — окно сборки закрыто (за 1 день), план зафиксирован
 * shipped     — фуры отгружены
 * cancelled   — заказ отменён
 */
export class CreateOrdersAndTrucks1700000004 implements MigrationInterface {
  name = 'CreateOrdersAndTrucks1700000004';

  async up(queryRunner: QueryRunner): Promise<void> {

    // ── Enum статусов заказа ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "order_status_enum" AS ENUM (
        'draft',
        'negotiating',
        'confirmed',
        'building',
        'locked',
        'shipped',
        'cancelled'
      )
    `);

    // ── orders ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id"                  SERIAL              PRIMARY KEY,
        "company_id"          INTEGER             NOT NULL
          REFERENCES "companies"("id") ON DELETE RESTRICT,

        -- Согласование дат
        "proposed_date"       DATE,
        "proposed_by_id"      INTEGER
          REFERENCES "users"("id") ON DELETE SET NULL,
        "proposed_at"         TIMESTAMPTZ,
        "confirmed_date"      DATE,
        "confirmed_by_id"     INTEGER
          REFERENCES "users"("id") ON DELETE SET NULL,
        "confirmed_at"        TIMESTAMPTZ,

        -- Статус
        "status"              "order_status_enum" NOT NULL DEFAULT 'draft',

        -- Дедлайн для сборки паллет (confirmed_date - 1 день в 23:59)
        "pallet_deadline"     TIMESTAMPTZ
          GENERATED ALWAYS AS (
            ("confirmed_date" - INTERVAL '1 day')::TIMESTAMPTZ
            + INTERVAL '23 hours 59 minutes'
          ) STORED,

        -- Итоги (обновляются триггером при изменении паллет)
        "total_pallets"       INTEGER             NOT NULL DEFAULT 0,
        "total_weight_kg"     DECIMAL(12,2)       NOT NULL DEFAULT 0,
        "total_amount_eur"    DECIMAL(14,2)       NOT NULL DEFAULT 0,

        "notes"               TEXT,
        "shipped_at"          TIMESTAMPTZ,
        "created_at"          TIMESTAMPTZ         NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ         NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_orders_company_status"
      ON "orders" ("company_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_orders_confirmed_date"
      ON "orders" ("confirmed_date")
      WHERE "confirmed_date" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_orders_deadline"
      ON "orders" ("pallet_deadline")
      WHERE "status" IN ('confirmed', 'building')
    `);

    await queryRunner.query(`
      CREATE TRIGGER "orders_updated_at"
      BEFORE UPDATE ON "orders"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);

    // ── trucks (фуры в составе заказа) ───────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "trucks" (
        "id"            SERIAL      PRIMARY KEY,
        "order_id"      INTEGER     NOT NULL
          REFERENCES "orders"("id") ON DELETE CASCADE,
        "number"        INTEGER     NOT NULL,   -- 1, 2, 3... в рамках заказа
        "max_pallets"   INTEGER     NOT NULL DEFAULT 33,
        "max_weight_kg" DECIMAL(12,2) NOT NULL DEFAULT 24000,

        -- Текущая загрузка (обновляется при assign паллет)
        "current_pallets"   INTEGER     NOT NULL DEFAULT 0,
        "current_weight_kg" DECIMAL(12,2) NOT NULL DEFAULT 0,

        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

        UNIQUE ("order_id", "number")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trucks_order_id" ON "trucks" ("order_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "orders_updated_at" ON "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trucks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
  }
}
