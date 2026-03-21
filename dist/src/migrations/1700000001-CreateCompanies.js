"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCompanies1700000001 = void 0;
class CreateCompanies1700000001 {
    constructor() {
        this.name = 'CreateCompanies1700000001';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
        await queryRunner.query(`
      CREATE TABLE "companies" (
        "id"             SERIAL        PRIMARY KEY,
        "name"           VARCHAR(500)  NOT NULL,
        "vat_number"     VARCHAR(50),
        "address"        TEXT,
        "city"           VARCHAR(255),
        "country_code"   CHAR(2)       NOT NULL DEFAULT 'PL',
        "email"          VARCHAR(255),
        "invoice_terms"  VARCHAR(20)   NOT NULL DEFAULT 'NET30'
          CHECK ("invoice_terms" IN ('NET30','NET60','NET90')),
        "group_chat_id"  BIGINT,
        "is_active"      BOOLEAN       NOT NULL DEFAULT true,
        "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);
        await queryRunner.query(`
      CREATE TRIGGER "companies_updated_at"
      BEFORE UPDATE ON "companies"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_companies_country" ON "companies" ("country_code")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TRIGGER IF EXISTS "companies_updated_at" ON "companies"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at`);
    }
}
exports.CreateCompanies1700000001 = CreateCompanies1700000001;
//# sourceMappingURL=1700000001-CreateCompanies.js.map