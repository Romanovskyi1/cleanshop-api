import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderStatusHistory1700000011000 implements MigrationInterface {
  name = 'CreateOrderStatusHistory1700000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_status_history" (
        "id"          SERIAL PRIMARY KEY,
        "order_id"    INTEGER NOT NULL,
        "from_status" "order_status_enum",
        "to_status"   "order_status_enum" NOT NULL,
        "actor_id"    INTEGER,
        "actor_role"  VARCHAR(20),
        "comment"     VARCHAR(500),
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_order_status_history_order"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_status_history_order_id"
        ON "order_status_history" ("order_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_order_status_history_order_id_created_at"
        ON "order_status_history" ("order_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_status_history_order_id_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_status_history_order_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_status_history"`);
    // "order_status_enum" принадлежит миграции 1700000004 — не трогаем
  }
}
