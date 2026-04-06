import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Миграция 009: добавить поле window_opens_at в orders.
 * pallet_deadline уже существует как windowClosesAt.
 */
export class AddWindowOpensAt1700000009000 implements MigrationInterface {
  name = 'AddWindowOpensAt1700000009000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "window_opens_at" TIMESTAMPTZ NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "window_opens_at"`);
  }
}
