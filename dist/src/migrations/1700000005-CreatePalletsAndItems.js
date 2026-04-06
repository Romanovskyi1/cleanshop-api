"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePalletsAndItems1700000005000 = void 0;
class CreatePalletsAndItems1700000005000 {
    constructor() {
        this.name = 'CreatePalletsAndItems1700000005000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TYPE "pallet_status_enum" AS ENUM (
        'building',   -- клиент собирает
        'ready',      -- собрана, ещё не назначена в фуру
        'assigned',   -- назначена в truck_id
        'locked'      -- окно закрыто, изменения запрещены
      )
    `);
        await queryRunner.query(`
      CREATE TABLE "pallets" (
        "id"               SERIAL               PRIMARY KEY,
        "company_id"       INTEGER              NOT NULL
          REFERENCES "companies"("id") ON DELETE RESTRICT,
        "order_id"         INTEGER
          REFERENCES "orders"("id") ON DELETE CASCADE,
        "truck_id"         INTEGER
          REFERENCES "trucks"("id") ON DELETE SET NULL,
        "name"             VARCHAR(100)         NOT NULL DEFAULT '',

        -- Автообновляется триггером
        "total_boxes"      INTEGER              NOT NULL DEFAULT 0,
        "total_weight_kg"  DECIMAL(10,2)        NOT NULL DEFAULT 0,
        "total_amount_eur" DECIMAL(14,2)        NOT NULL DEFAULT 0,

        "status"           "pallet_status_enum" NOT NULL DEFAULT 'building',
        "created_at"       TIMESTAMPTZ          NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ          NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_pallets_company_order"
      ON "pallets" ("company_id", "order_id")
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_pallets_truck_id"
      ON "pallets" ("truck_id")
      WHERE "truck_id" IS NOT NULL
    `);
        await queryRunner.query(`
      CREATE TRIGGER "pallets_updated_at"
      BEFORE UPDATE ON "pallets"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
        await queryRunner.query(`
      CREATE TABLE "pallet_items" (
        "id"          SERIAL        PRIMARY KEY,
        "pallet_id"   INTEGER       NOT NULL
          REFERENCES "pallets"("id") ON DELETE CASCADE,
        "product_id"  INTEGER       NOT NULL
          REFERENCES "products"("id") ON DELETE RESTRICT,

        "boxes"       INTEGER       NOT NULL CHECK ("boxes" > 0),

        -- Цена фиксируется на момент добавления (защита от изменения прайса)
        "price_eur"   DECIMAL(12,2) NOT NULL,
        "subtotal"    DECIMAL(14,2) NOT NULL
          GENERATED ALWAYS AS ("boxes" * "price_eur") STORED,

        -- Расчётный вес строки (boxes * weight_per_box)
        -- Заполняется приложением при добавлении
        "weight_kg"   DECIMAL(10,2) NOT NULL DEFAULT 0,

        "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),

        UNIQUE ("pallet_id", "product_id")
      )
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_pallet_items_pallet_id"
      ON "pallet_items" ("pallet_id")
    `);
        await queryRunner.query(`
      CREATE TRIGGER "pallet_items_updated_at"
      BEFORE UPDATE ON "pallet_items"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION recalc_pallet_totals()
      RETURNS TRIGGER AS $$
      DECLARE
        v_pallet_id INTEGER;
      BEGIN
        -- Определяем pallet_id из изменённой/удалённой строки
        v_pallet_id := COALESCE(NEW.pallet_id, OLD.pallet_id);

        UPDATE "pallets"
        SET
          "total_boxes"      = COALESCE((
            SELECT SUM("boxes")
            FROM "pallet_items"
            WHERE "pallet_id" = v_pallet_id
          ), 0),
          "total_weight_kg"  = COALESCE((
            SELECT SUM("weight_kg")
            FROM "pallet_items"
            WHERE "pallet_id" = v_pallet_id
          ), 0),
          "total_amount_eur" = COALESCE((
            SELECT SUM("subtotal")
            FROM "pallet_items"
            WHERE "pallet_id" = v_pallet_id
          ), 0)
        WHERE "id" = v_pallet_id;

        RETURN NULL; -- AFTER trigger, возвращаемое значение игнорируется
      END;
      $$ LANGUAGE plpgsql
    `);
        await queryRunner.query(`
      CREATE TRIGGER "pallet_items_recalc"
      AFTER INSERT OR UPDATE OR DELETE ON "pallet_items"
      FOR EACH ROW EXECUTE FUNCTION recalc_pallet_totals()
    `);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION recalc_order_totals()
      RETURNS TRIGGER AS $$
      DECLARE
        v_order_id INTEGER;
      BEGIN
        v_order_id := COALESCE(NEW.order_id, OLD.order_id);
        IF v_order_id IS NULL THEN
          RETURN NULL;
        END IF;

        UPDATE "orders"
        SET
          "total_pallets"    = COALESCE((
            SELECT COUNT(*)
            FROM "pallets"
            WHERE "order_id" = v_order_id
          ), 0),
          "total_weight_kg"  = COALESCE((
            SELECT SUM("total_weight_kg")
            FROM "pallets"
            WHERE "order_id" = v_order_id
          ), 0),
          "total_amount_eur" = COALESCE((
            SELECT SUM("total_amount_eur")
            FROM "pallets"
            WHERE "order_id" = v_order_id
          ), 0)
        WHERE "id" = v_order_id;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);
        await queryRunner.query(`
      CREATE TRIGGER "pallets_recalc_order"
      AFTER INSERT OR UPDATE OR DELETE ON "pallets"
      FOR EACH ROW EXECUTE FUNCTION recalc_order_totals()
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TRIGGER IF EXISTS "pallets_recalc_order"   ON "pallets"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS "pallet_items_recalc"    ON "pallet_items"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS "pallet_items_updated_at" ON "pallet_items"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS "pallets_updated_at"     ON "pallets"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS recalc_order_totals`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS recalc_pallet_totals`);
        await queryRunner.query(`DROP TABLE IF EXISTS "pallet_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "pallets"`);
        await queryRunner.query(`DROP TYPE  IF EXISTS "pallet_status_enum"`);
    }
}
exports.CreatePalletsAndItems1700000005000 = CreatePalletsAndItems1700000005000;
//# sourceMappingURL=1700000005-CreatePalletsAndItems.js.map