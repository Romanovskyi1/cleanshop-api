import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntentToChat1700000010000 implements MigrationInterface {
  name = 'AddIntentToChat1700000010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Enum для intent
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "message_intent_enum" AS ENUM (
          'informational', 'transactional', 'logistical', 'complaint', 'escalate'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Добавляем intent
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
        ADD COLUMN IF NOT EXISTS "intent" "message_intent_enum" NULL;
    `);

    // Добавляем card_payload (entity использует это имя, TypeORM маппит cardPayload → card_payload)
    await queryRunner.query(`
      ALTER TABLE "chat_messages"
        ADD COLUMN IF NOT EXISTS "card_payload" JSONB NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "intent"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "card_payload"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "message_intent_enum"`);
  }
}
