import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Миграция 006: invoices + invoice_deliveries
 *
 * invoice_deliveries — лог доставки инвойса по трём каналам:
 *   telegram_personal | telegram_group | email
 *
 * Хранение: минимум 7 лет (EU Accounting Directive).
 * Файл PDF хранится в S3/R2, ссылка в pdf_url.
 */
export class CreateInvoices1700000006000 implements MigrationInterface {
  name = 'CreateInvoices1700000006000';

  async up(queryRunner: QueryRunner): Promise<void> {

    // ── Enum статусов инвойса ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "invoice_status_enum" AS ENUM (
        'pending',    -- выставлен, ждём оплаты
        'paid',       -- оплата получена (менеджер проставляет вручную)
        'overdue',    -- просрочен (прошёл due_date)
        'cancelled'   -- аннулирован
      )
    `);

    // ── invoices ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id"              SERIAL                  PRIMARY KEY,
        "order_id"        INTEGER                 NOT NULL
          REFERENCES "orders"("id") ON DELETE RESTRICT,
        "company_id"      INTEGER                 NOT NULL
          REFERENCES "companies"("id") ON DELETE RESTRICT,

        -- Номер инвойса: INV-2025-0047
        "invoice_number"  VARCHAR(50)             NOT NULL,

        "issued_at"       TIMESTAMPTZ             NOT NULL DEFAULT now(),

        -- Срок оплаты считается от issued_at + terms
        "due_date"        DATE                    NOT NULL,

        -- Финансовые данные
        "subtotal_eur"    DECIMAL(14,2)           NOT NULL,
        "vat_rate"        DECIMAL(5,2)            NOT NULL,   -- напр. 23.00
        "vat_amount"      DECIMAL(14,2)           NOT NULL,
        "total_eur"       DECIMAL(14,2)           NOT NULL,

        -- JSONB-снимок позиций на момент выставления
        -- (защита от изменения заказа задним числом)
        "line_items"      JSONB                   NOT NULL DEFAULT '[]',

        "status"          "invoice_status_enum"   NOT NULL DEFAULT 'pending',
        "pdf_url"         TEXT,
        "paid_at"         TIMESTAMPTZ,
        "paid_by_id"      INTEGER
          REFERENCES "users"("id") ON DELETE SET NULL,

        "notes"           TEXT,
        "created_at"      TIMESTAMPTZ             NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ             NOT NULL DEFAULT now(),

        CONSTRAINT "UQ_invoices_number" UNIQUE ("invoice_number")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invoices_company_status"
      ON "invoices" ("company_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invoices_order_id"
      ON "invoices" ("order_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invoices_due_date"
      ON "invoices" ("due_date")
      WHERE "status" = 'pending'
    `);

    await queryRunner.query(`
      CREATE TRIGGER "invoices_updated_at"
      BEFORE UPDATE ON "invoices"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);

    // ── invoice_deliveries (лог отправки) ────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "delivery_channel_enum" AS ENUM (
        'telegram_personal',
        'telegram_group',
        'email'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "delivery_status_enum" AS ENUM (
        'sent',
        'failed',
        'resent'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "invoice_deliveries" (
        "id"          SERIAL                    PRIMARY KEY,
        "invoice_id"  INTEGER                   NOT NULL
          REFERENCES "invoices"("id") ON DELETE CASCADE,
        "channel"     "delivery_channel_enum"   NOT NULL,
        "status"      "delivery_status_enum"    NOT NULL DEFAULT 'sent',
        "recipient"   VARCHAR(500),             -- email или telegram username
        "error"       TEXT,                     -- сообщение об ошибке при failed
        "sent_at"     TIMESTAMPTZ               NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_deliveries_invoice_id"
      ON "invoice_deliveries" ("invoice_id")
    `);

    // ── Sequence для номеров инвойсов (INV-YYYY-NNNN) ────────────────
    await queryRunner.query(`
      CREATE SEQUENCE "invoice_number_seq" START 1 INCREMENT 1
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE  IF EXISTS "invoice_number_seq"`);
    await queryRunner.query(`DROP TRIGGER   IF EXISTS "invoices_updated_at" ON "invoices"`);
    await queryRunner.query(`DROP TABLE     IF EXISTS "invoice_deliveries"`);
    await queryRunner.query(`DROP TABLE     IF EXISTS "invoices"`);
    await queryRunner.query(`DROP TYPE      IF EXISTS "delivery_status_enum"`);
    await queryRunner.query(`DROP TYPE      IF EXISTS "delivery_channel_enum"`);
    await queryRunner.query(`DROP TYPE      IF EXISTS "invoice_status_enum"`);
  }
}
