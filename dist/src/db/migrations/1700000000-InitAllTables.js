"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitAllTables1700000000000 = void 0;
class InitAllTables1700000000000 {
    constructor() {
        this.name = 'InitAllTables1700000000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
        await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('client', 'manager', 'admin')
    `);
        await queryRunner.query(`
      CREATE TYPE "product_category_enum" AS ENUM (
        'gel', 'powder', 'concentrate', 'tablet', 'spray'
      )
    `);
        await queryRunner.query(`
      CREATE TYPE "order_status_enum" AS ENUM (
        'draft', 'negotiating', 'confirmed',
        'building', 'locked', 'shipped', 'cancelled'
      )
    `);
        await queryRunner.query(`
      CREATE TYPE "pallet_status_enum" AS ENUM (
        'building', 'ready', 'assigned', 'locked'
      )
    `);
        await queryRunner.query(`
      CREATE TYPE "invoice_status_enum" AS ENUM (
        'pending', 'paid', 'overdue', 'cancelled'
      )
    `);
        await queryRunner.query(`
      CREATE TYPE "delivery_channel_enum" AS ENUM (
        'telegram_personal', 'telegram_group', 'email'
      )
    `);
        await queryRunner.query(`
      CREATE TYPE "delivery_status_enum" AS ENUM (
        'pending', 'sent', 'failed'
      )
    `);
        await queryRunner.query(`
      CREATE TYPE "sender_type_enum" AS ENUM ('client', 'manager', 'ai')
    `);
        await queryRunner.query(`
      CREATE TYPE "message_intent_enum" AS ENUM (
        'informational', 'transactional',
        'logistical', 'complaint', 'escalate'
      )
    `);
        await queryRunner.query(`
      CREATE TABLE "companies" (
        "id"              SERIAL        PRIMARY KEY,
        "name"            VARCHAR(500)  NOT NULL,
        "vat_number"      VARCHAR(50),
        "address"         TEXT,
        "country_code"    CHAR(2)       NOT NULL DEFAULT 'DE',
        "invoice_email"   VARCHAR(255),
        "telegram_group_chat_id" VARCHAR(50),
        "invoice_terms"   VARCHAR(20)   NOT NULL DEFAULT 'NET30',
        "is_active"       BOOLEAN       NOT NULL DEFAULT true,
        "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE TRIGGER "companies_updated_at"
      BEFORE UPDATE ON "companies"
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()
    `);
        await queryRunner.query(`
      CREATE TABLE "users" (
        "id"              SERIAL            PRIMARY KEY,
        "telegram_id"     BIGINT            NOT NULL,
        "username"        VARCHAR(255),
        "first_name"      VARCHAR(255),
        "last_name"       VARCHAR(255),
        "language_code"   VARCHAR(10)       NOT NULL DEFAULT 'en',
        "company_id"      INTEGER
          REFERENCES "companies"("id") ON DELETE SET NULL,
        "role"            "user_role_enum"  NOT NULL DEFAULT 'client',
        "gdpr_consent_at" TIMESTAMPTZ,
        "is_active"       BOOLEAN           NOT NULL DEFAULT true,
        "created_at"      TIMESTAMPTZ       NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ       NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_users_telegram_id"
        ON "users" ("telegram_id")
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_users_company_id"
        ON "users" ("company_id")
        WHERE "company_id" IS NOT NULL
    `);
        await queryRunner.query(`
      CREATE TRIGGER "users_updated_at"
      BEFORE UPDATE ON "users"
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()
    `);
        await queryRunner.query(`
      CREATE TABLE "products" (
        "id"                SERIAL                    PRIMARY KEY,
        "sku"               VARCHAR(50)               NOT NULL,
        "name"              JSONB                     NOT NULL DEFAULT '{}',
        "description"       JSONB,
        "category"          "product_category_enum"   NOT NULL,
        "volume_l"          DECIMAL(10,3),
        "weight_kg"         DECIMAL(10,3),
        "price_eur"         DECIMAL(12,2)             NOT NULL,
        "units_per_box"     INTEGER                   NOT NULL DEFAULT 1,
        "boxes_per_pallet"  INTEGER                   NOT NULL DEFAULT 40,
        "pallets_per_truck" INTEGER                   NOT NULL DEFAULT 33,
        "pallet_weight_kg"  DECIMAL(10,2),
        "box_weight_kg"     DECIMAL(10,3),
        "stock_pallets"     INTEGER                   NOT NULL DEFAULT 0,
        "is_eco"            BOOLEAN                   NOT NULL DEFAULT false,
        "certifications"    TEXT[]                    NOT NULL DEFAULT '{}',
        "images"            TEXT[]                    NOT NULL DEFAULT '{}',
        "is_active"         BOOLEAN                   NOT NULL DEFAULT true,
        "is_new"            BOOLEAN                   NOT NULL DEFAULT false,
        "is_hit"            BOOLEAN                   NOT NULL DEFAULT false,
        "created_at"        TIMESTAMPTZ               NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ               NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_products_sku" ON "products" ("sku")
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_products_name_gin"
        ON "products" USING gin ("name")
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_products_active_stock"
        ON "products" ("category", "stock_pallets")
        WHERE "is_active" = true
    `);
        await queryRunner.query(`
      CREATE TRIGGER "products_updated_at"
      BEFORE UPDATE ON "products"
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()
    `);
        await queryRunner.query(`
      CREATE TABLE "orders" (
        "id"               SERIAL               PRIMARY KEY,
        "company_id"       INTEGER              NOT NULL
          REFERENCES "companies"("id"),
        "proposed_date"    DATE,
        "confirmed_date"   DATE,
        "status"           "order_status_enum"  NOT NULL DEFAULT 'draft',
        "proposed_by"      INTEGER
          REFERENCES "users"("id") ON DELETE SET NULL,
        "confirmed_by"     INTEGER
          REFERENCES "users"("id") ON DELETE SET NULL,
        "total_pallets"    INTEGER              NOT NULL DEFAULT 0,
        "total_weight_kg"  DECIMAL(12,2),
        "total_amount_eur" DECIMAL(14,2),
        "notes"            TEXT,
        "created_at"       TIMESTAMPTZ          NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ          NOT NULL DEFAULT now()
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
      CREATE TRIGGER "orders_updated_at"
      BEFORE UPDATE ON "orders"
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()
    `);
        await queryRunner.query(`
      CREATE TABLE "trucks" (
        "id"            SERIAL         PRIMARY KEY,
        "order_id"      INTEGER        NOT NULL
          REFERENCES "orders"("id") ON DELETE CASCADE,
        "number"        SMALLINT       NOT NULL,
        "max_pallets"   SMALLINT       NOT NULL DEFAULT 33,
        "max_weight_kg" DECIMAL(12,2)  NOT NULL DEFAULT 24000,
        "created_at"    TIMESTAMPTZ    NOT NULL DEFAULT now(),
        CONSTRAINT "uq_trucks_order_number" UNIQUE ("order_id", "number")
      )
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_trucks_order_id" ON "trucks" ("order_id")
    `);
        await queryRunner.query(`
      CREATE TABLE "pallets" (
        "id"               SERIAL               PRIMARY KEY,
        "company_id"       INTEGER              NOT NULL,
        "order_id"         INTEGER
          REFERENCES "orders"("id") ON DELETE SET NULL,
        "truck_id"         INTEGER
          REFERENCES "trucks"("id") ON DELETE SET NULL,
        "name"             VARCHAR(100),
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
      CREATE INDEX "IDX_pallets_status"
        ON "pallets" ("status")
    `);
        await queryRunner.query(`
      CREATE TRIGGER "pallets_updated_at"
      BEFORE UPDATE ON "pallets"
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()
    `);
        await queryRunner.query(`
      CREATE TABLE "pallet_items" (
        "id"           SERIAL         PRIMARY KEY,
        "pallet_id"    INTEGER        NOT NULL
          REFERENCES "pallets"("id") ON DELETE CASCADE,
        "product_id"   INTEGER        NOT NULL
          REFERENCES "products"("id"),
        "price_eur"    DECIMAL(12,2)  NOT NULL,
        "boxes"        INTEGER        NOT NULL CHECK ("boxes" > 0),
        "subtotal_eur" DECIMAL(14,2)  NOT NULL,
        "created_at"   TIMESTAMPTZ    NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ    NOT NULL DEFAULT now(),
        CONSTRAINT "uq_pallet_items_pallet_product"
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
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()
    `);
        await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id"                SERIAL                 PRIMARY KEY,
        "invoice_number"    VARCHAR(50)            NOT NULL,
        "order_id"          INTEGER                NOT NULL
          REFERENCES "orders"("id"),
        "company_id"        INTEGER                NOT NULL
          REFERENCES "companies"("id"),
        "created_by"        INTEGER                NOT NULL
          REFERENCES "users"("id"),
        "issued_at"         TIMESTAMPTZ            NOT NULL,
        "due_date"          DATE                   NOT NULL,
        "subtotal_eur"      DECIMAL(14,2)          NOT NULL,
        "vat_rate"          DECIMAL(5,2)           NOT NULL,
        "vat_amount"        DECIMAL(14,2)          NOT NULL,
        "total_eur"         DECIMAL(14,2)          NOT NULL,
        "status"            "invoice_status_enum"  NOT NULL DEFAULT 'pending',
        "pdf_url"           TEXT,
        "original_filename" VARCHAR(255),
        "paid_at"           TIMESTAMPTZ,
        "created_at"        TIMESTAMPTZ            NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ            NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_invoices_number"
        ON "invoices" ("invoice_number")
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_invoices_company_status"
        ON "invoices" ("company_id", "status")
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_invoices_overdue"
        ON "invoices" ("due_date")
        WHERE "status" = 'pending'
    `);
        await queryRunner.query(`
      CREATE TRIGGER "invoices_updated_at"
      BEFORE UPDATE ON "invoices"
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()
    `);
        await queryRunner.query(`
      CREATE TABLE "invoice_deliveries" (
        "id"            SERIAL                    PRIMARY KEY,
        "invoice_id"    INTEGER                   NOT NULL
          REFERENCES "invoices"("id") ON DELETE CASCADE,
        "channel"       "delivery_channel_enum"   NOT NULL,
        "status"        "delivery_status_enum"    NOT NULL DEFAULT 'pending',
        "external_id"   VARCHAR(255),
        "error_message" TEXT,
        "attempts"      SMALLINT                  NOT NULL DEFAULT 0,
        "sent_at"       TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ               NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_deliveries_invoice_id"
        ON "invoice_deliveries" ("invoice_id")
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_deliveries_failed"
        ON "invoice_deliveries" ("invoice_id", "channel")
        WHERE "status" = 'failed'
    `);
        await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id"             BIGSERIAL                  PRIMARY KEY,
        "company_id"     INTEGER                    NOT NULL,
        "sender_id"      INTEGER
          REFERENCES "users"("id") ON DELETE SET NULL,
        "sender_type"    "sender_type_enum"         NOT NULL,
        "text"           TEXT                       NOT NULL,
        "attachment_url" TEXT,
        "intent"         "message_intent_enum",
        "card_payload"   JSONB,
        "is_read"        BOOLEAN                    NOT NULL DEFAULT false,
        "created_at"     TIMESTAMPTZ                NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_chat_company_time"
        ON "chat_messages" ("company_id", "created_at" DESC)
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_chat_unread"
        ON "chat_messages" ("company_id", "is_read")
        WHERE "is_read" = false
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_chat_escalate"
        ON "chat_messages" ("intent", "created_at" DESC)
        WHERE "intent" = 'escalate'
    `);
        await queryRunner.query(`
      CREATE VIEW "v_truck_summary" AS
      SELECT
        t.id                                        AS truck_id,
        t.order_id,
        t.number                                    AS truck_number,
        t.max_pallets,
        t.max_weight_kg,
        COUNT(p.id)                                 AS pallet_count,
        COALESCE(SUM(p.total_weight_kg), 0)         AS total_weight_kg,
        COALESCE(SUM(p.total_amount_eur), 0)        AS total_amount_eur,
        ROUND(
          COUNT(p.id)::numeric / NULLIF(t.max_pallets, 0) * 100, 1
        )                                           AS pallet_fill_pct,
        ROUND(
          COALESCE(SUM(p.total_weight_kg), 0)
            / NULLIF(t.max_weight_kg::numeric, 0) * 100, 1
        )                                           AS weight_fill_pct
      FROM trucks t
      LEFT JOIN pallets p ON p.truck_id = t.id
      GROUP BY t.id, t.order_id, t.number, t.max_pallets, t.max_weight_kg
    `);
        await queryRunner.query(`
      CREATE VIEW "v_company_dashboard" AS
      SELECT
        c.id                                                  AS company_id,
        COUNT(DISTINCT o.id)
          FILTER (WHERE o.status NOT IN ('shipped','cancelled'))  AS active_orders,
        COUNT(DISTINCT p.id)
          FILTER (WHERE p.status IN ('building','ready'))         AS pallets_in_progress,
        COUNT(DISTINCT p.id)
          FILTER (WHERE p.status = 'assigned')                    AS pallets_assigned,
        COUNT(DISTINCT inv.id)
          FILTER (WHERE inv.status = 'pending')                   AS invoices_pending,
        COALESCE(SUM(inv.total_eur)
          FILTER (WHERE inv.status = 'pending'), 0)               AS amount_pending_eur,
        MIN(o.confirmed_date)
          FILTER (
            WHERE o.status IN ('confirmed','building','locked')
            AND o.confirmed_date >= CURRENT_DATE
          )                                                       AS next_loading_date
      FROM companies c
      LEFT JOIN orders  o   ON o.company_id   = c.id
      LEFT JOIN pallets p   ON p.company_id   = c.id
      LEFT JOIN invoices inv ON inv.company_id = c.id
      GROUP BY c.id
    `);
        await queryRunner.query(`
      INSERT INTO "companies"
        (name, vat_number, address, country_code, invoice_email, invoice_terms)
      VALUES
        (
          'CleanService sp. z o.o.',
          'PL9876543210',
          'ul. Marszałkowska 84, 00-514 Warszawa, PL',
          'PL',
          'invoices@cleanservice.pl',
          'NET30'
        )
    `);
        await queryRunner.query(`
      INSERT INTO "users"
        (telegram_id, username, first_name, last_name, language_code, company_id, role)
      VALUES
        (123456789, 'klausw', 'Klaus', 'Weber', 'de', 1, 'client'),
        (987654321, 'anna_mgr', 'Anna', 'Schmidt', 'de', NULL, 'manager')
    `);
        await queryRunner.query(`
      INSERT INTO "products" (
        sku, name, description, category,
        volume_l, price_eur, units_per_box, boxes_per_pallet,
        pallets_per_truck, pallet_weight_kg, box_weight_kg,
        stock_pallets, is_eco, certifications, is_hit, is_new, is_active
      ) VALUES
      (
        'GC-028-5L',
        '{"ru":"GreenClean Гель для посуды 5L","en":"GreenClean Dish Gel 5L","de":"GreenClean Geschirrspülmittel 5L","pl":"GreenClean Płyn do naczyń 5L"}',
        '{"ru":"Концентрированный гель. Без фосфатов.","en":"Concentrated dish gel. Phosphate-free."}',
        'gel', 5.0, 12.40, 24, 40, 33, 820, 14.5, 84,
        true, ARRAY['EU Ecolabel','Phosphate-free','Biodegradable'],
        true, false, true
      ),
      (
        'CP-003-3K',
        '{"ru":"CleanPro Порошок универсал 3кг","en":"CleanPro Universal Powder 3kg","de":"CleanPro Universalpulver 3kg","pl":"CleanPro Proszek 3kg"}',
        '{"ru":"Универсальный стиральный порошок.","en":"Universal laundry powder."}',
        'powder', null, 8.80, 24, 48, 33, 920, 13.2, 120,
        false, ARRAY[]::text[],
        true, false, true
      ),
      (
        'AQ-115-1L',
        '{"ru":"AquaFresh Концентрат пола 1L","en":"AquaFresh Floor Concentrate 1L","de":"AquaFresh Bodenreiniger 1L","pl":"AquaFresh Koncentrat 1L"}',
        '{"ru":"Концентрат 1:50 для всех полов.","en":"1:50 concentrate, all floors."}',
        'concentrate', 1.0, 6.50, 24, 60, 33, 780, 10.0, 7,
        true, ARRAY['EU Ecolabel','Vegan'],
        false, true, true
      ),
      (
        'GC-041-3L',
        '{"ru":"GreenClean Гель для стирки 3L","en":"GreenClean Laundry Gel 3L","de":"GreenClean Waschmittel 3L","pl":"GreenClean Żel do prania 3L"}',
        '{"ru":"Деликатная стирка. Без красителей.","en":"Gentle wash. Dye-free."}',
        'gel', 3.0, 9.20, 24, 42, 33, 860, 15.0, 55,
        true, ARRAY['EU Ecolabel','Dye-free'],
        false, false, true
      ),
      (
        'AQ-220-5L',
        '{"ru":"AquaFresh Ополаскиватель 5L","en":"AquaFresh Fabric Softener 5L","de":"AquaFresh Weichspüler 5L","pl":"AquaFresh Płyn 5L"}',
        '{"ru":"Гипоаллергенная формула.","en":"Hypoallergenic formula."}',
        'concentrate', 5.0, 11.10, 24, 40, 33, 800, 14.8, 30,
        false, ARRAY['Hypoallergenic'],
        false, true, true
      )
    `);
        await queryRunner.query(`
      INSERT INTO "orders"
        (company_id, proposed_date, confirmed_date, status,
         proposed_by, confirmed_by, total_pallets)
      VALUES
        (1, '2025-03-18', '2025-03-18', 'building', 1, 2, 47)
    `);
        await queryRunner.query(`
      INSERT INTO "trucks" (order_id, number, max_pallets, max_weight_kg)
      VALUES (1, 1, 33, 24000),
             (1, 2, 33, 24000)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP VIEW IF EXISTS "v_company_dashboard"`);
        await queryRunner.query(`DROP VIEW IF EXISTS "v_truck_summary"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "invoice_deliveries"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "invoices"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "pallet_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "pallets"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "trucks"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "message_intent_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "sender_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "delivery_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "delivery_channel_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "invoice_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "pallet_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "order_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "product_category_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column()`);
    }
}
exports.InitAllTables1700000000000 = InitAllTables1700000000000;
//# sourceMappingURL=1700000000-InitAllTables.js.map