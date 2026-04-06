import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Миграция 002: таблица users
 *
 * Пользователи авторизуются через Telegram InitData.
 * Каждый user привязан к company через company_id.
 */
export class CreateUsers1700000002000 implements MigrationInterface {
  name = 'CreateUsers1700000002000';

  async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('client', 'manager', 'admin')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"              SERIAL           PRIMARY KEY,
        "telegram_id"     BIGINT           NOT NULL,
        "username"        VARCHAR(255),
        "first_name"      VARCHAR(255),
        "last_name"       VARCHAR(255),
        "language_code"   VARCHAR(10)      NOT NULL DEFAULT 'en',
        "company_id"      INTEGER
          REFERENCES "companies"("id") ON DELETE SET NULL,
        "role"            "user_role_enum" NOT NULL DEFAULT 'client',
        "gdpr_consent_at" TIMESTAMPTZ,
        "is_active"       BOOLEAN          NOT NULL DEFAULT true,
        "created_at"      TIMESTAMPTZ      NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ      NOT NULL DEFAULT now()
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
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "users_updated_at" ON "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
