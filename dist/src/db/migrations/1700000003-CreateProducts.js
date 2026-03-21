"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateProducts1700000003000 = void 0;
class CreateProducts1700000003000 {
    constructor() {
        this.name = 'CreateProducts1700000003000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TYPE "product_category_enum"
      AS ENUM ('gel', 'powder', 'concentrate', 'tablets', 'spray', 'other')
    `);
        await queryRunner.query(`
      CREATE TABLE "products" (
        "id"                 SERIAL                   PRIMARY KEY,
        "sku"                VARCHAR(50)              NOT NULL,
        "name"               JSONB                    NOT NULL DEFAULT '{}',
        "description"        JSONB                    NOT NULL DEFAULT '{}',
        "category"           "product_category_enum"  NOT NULL DEFAULT 'other',

        "volume_l"           DECIMAL(10,3),
        "weight_per_unit_kg" DECIMAL(10,3),

        "price_eur"          DECIMAL(12,2)            NOT NULL,

        "units_per_box"      INTEGER                  NOT NULL DEFAULT 1,
        "boxes_per_pallet"   INTEGER                  NOT NULL DEFAULT 1,
        "pallets_per_truck"  INTEGER                  NOT NULL DEFAULT 33,

        "pallet_weight_kg"   DECIMAL(10,2),

        "stock_pallets"      INTEGER                  NOT NULL DEFAULT 0,
        "stock_updated_at"   TIMESTAMPTZ,

        "is_eco"             BOOLEAN                  NOT NULL DEFAULT false,
        "certifications"     TEXT[]                   NOT NULL DEFAULT '{}',

        "images"             TEXT[]                   NOT NULL DEFAULT '{}',

        "is_active"          BOOLEAN                  NOT NULL DEFAULT true,
        "sort_order"         INTEGER                  NOT NULL DEFAULT 0,
        "created_at"         TIMESTAMPTZ              NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMPTZ              NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_products_sku" ON "products" ("sku")
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_products_category_active"
      ON "products" ("category", "is_active")
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_products_name_search"
      ON "products" USING GIN (
        to_tsvector('simple',
          coalesce("name"->>'ru','') || ' ' ||
          coalesce("name"->>'en','') || ' ' ||
          "sku"
        )
      )
    `);
        await queryRunner.query(`
      CREATE TRIGGER "products_updated_at"
      BEFORE UPDATE ON "products"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TRIGGER IF EXISTS "products_updated_at" ON "products"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "product_category_enum"`);
    }
}
exports.CreateProducts1700000003000 = CreateProducts1700000003000;
//# sourceMappingURL=1700000003-CreateProducts.js.map