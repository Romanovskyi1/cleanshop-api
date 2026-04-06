import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Миграция 008: добавить поле truck_type в orders
 * Значения: small_5t (5-тонный малый) | large_24t (24-тонный большой)
 */
export class AddTruckTypeToOrders1700000008000 implements MigrationInterface {
  name = 'AddTruckTypeToOrders1700000008000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "truck_type_enum" AS ENUM ('small_5t', 'large_24t')
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN "truck_type" "truck_type_enum" NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "truck_type"`);
    await queryRunner.query(`DROP TYPE "truck_type_enum"`);
  }
}
