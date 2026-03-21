import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Миграция: создание таблицы users.
 * Запуск: npm run migration:run
 * Откат:  npm run migration:revert
 */
export class CreateUsers1700000001000 implements MigrationInterface {
  name = 'CreateUsers1700000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enum type для ролей ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('client', 'manager', 'admin')
    `);

    // ── Таблица users ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"              SERIAL        PRIMARY KEY,
        "telegram_id"     BIGINT        NOT NULL,
        "username"        VARCHAR(255),
        "first_name"      VARCHAR(255),
        "last_name"       VARCHAR(255),
        "language_code"   VARCHAR(10)   NOT NULL DEFAULT 'en',
        "company_id"      INTEGER,
        "role"            "user_role_enum" NOT NULL DEFAULT 'client',
        "gdpr_consent_at" TIMESTAMPTZ,
        "is_active"       BOOLEAN       NOT NULL DEFAULT true,
        "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `);

    // ── Уникальный индекс по telegram_id ────────────────────────────────
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_users_telegram_id" ON "users" ("telegram_id")
    `);

    // ── Индекс по company_id (частые JOIN) ──────────────────────────────
    await queryRunner.query(`
      CREATE INDEX "IDX_users_company_id" ON "users" ("company_id")
      WHERE "company_id" IS NOT NULL
    `);

    // ── Trigger: автообновление updated_at ──────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await queryRunner.query(`
      CREATE TRIGGER "users_updated_at"
      BEFORE UPDATE ON "users"
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "users_updated_at" ON "users"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
    // Функцию НЕ удаляем — она будет нужна другим таблицам
  }
}
