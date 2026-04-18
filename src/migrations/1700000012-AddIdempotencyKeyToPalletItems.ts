import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdempotencyKeyToPalletItems1700000012000 implements MigrationInterface {
  name = 'AddIdempotencyKeyToPalletItems1700000012000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pallet_items ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_pallet_items_pallet_idem
      ON pallet_items (pallet_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_pallet_items_pallet_idem`);
    await queryRunner.query(`ALTER TABLE pallet_items DROP COLUMN IF EXISTS idempotency_key`);
  }
}
