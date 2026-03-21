"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateInvoices1700000006000 = void 0;
class CreateInvoices1700000006000 {
    constructor() {
        this.name = 'CreateInvoices1700000006000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TYPE "invoice_status_enum" AS ENUM (
        'pending',    -- выставлен, ждём оплаты
        'paid',       -- оплата получена (менеджер проставляет вручную)
        'overdue',    -- просрочен (прошёл due_date)
        'cancelled'   -- аннулирован
      )
    `);
        await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id"              SERIAL                  PRIMARY KEY,
        "order_id"        INTEGER                 NOT NULL
          REFERENCES "orders"("id") ON DELETE RESTRICT,
        "company_id"      INTEGER                 NOT NULL
          REFERENCES "companies"("id") ON DELETE RESTRICT,

        "invoice_number"  VARCHAR(50)             NOT NULL,

        "issued_at"       TIMESTAMPTZ             NOT NULL DEFAULT now(),

        "due_date"        DATE                    NOT NULL,

        "subtotal_eur"    DECIMAL(14,2)           NOT NULL,
        "vat_rate"        DECIMAL(5,2)            NOT NULL,   -- напр. 23.00
        "vat_amount"      DECIMAL(14,2)           NOT NULL,
        "total_eur"       DECIMAL(14,2)           NOT NULL,

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
        await queryRunner.query(`
      CREATE SEQUENCE "invoice_number_seq" START 1 INCREMENT 1
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP SEQUENCE  IF EXISTS "invoice_number_seq"`);
        await queryRunner.query(`DROP TRIGGER   IF EXISTS "invoices_updated_at" ON "invoices"`);
        await queryRunner.query(`DROP TABLE     IF EXISTS "invoice_deliveries"`);
        await queryRunner.query(`DROP TABLE     IF EXISTS "invoices"`);
        await queryRunner.query(`DROP TYPE      IF EXISTS "delivery_status_enum"`);
        await queryRunner.query(`DROP TYPE      IF EXISTS "delivery_channel_enum"`);
        await queryRunner.query(`DROP TYPE      IF EXISTS "invoice_status_enum"`);
    }
}
exports.CreateInvoices1700000006000 = CreateInvoices1700000006000;
//# sourceMappingURL=1700000006-CreateInvoices.js.map