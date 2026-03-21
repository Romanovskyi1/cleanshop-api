import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Миграция 007: chat_messages + notifications
 *
 * chat_messages — сообщения чата поддержки.
 *   sender_type: 'client' | 'manager' | 'ai'
 *   Если sender_id IS NULL → сообщение от ИИ.
 *
 * notifications — лог push-уведомлений клиентам.
 *   Используется для отображения колокольчика в TMA
 *   и истории уведомлений.
 */
export class CreateChatAndNotifications1700000007000 implements MigrationInterface {
  name = 'CreateChatAndNotifications1700000007000';

  async up(queryRunner: QueryRunner): Promise<void> {

    // ── Enum типов отправителей ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "sender_type_enum" AS ENUM ('client', 'manager', 'ai')
    `);

    // ── chat_messages ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id"            BIGSERIAL               PRIMARY KEY,
        "company_id"    INTEGER                 NOT NULL
          REFERENCES "companies"("id") ON DELETE CASCADE,
        "sender_id"     INTEGER
          REFERENCES "users"("id") ON DELETE SET NULL,
        "sender_type"   "sender_type_enum"      NOT NULL,
        "text"          TEXT,
        "attachment_url" TEXT,

        "card_data"     JSONB,

        "is_read"       BOOLEAN                 NOT NULL DEFAULT false,
        "created_at"    TIMESTAMPTZ             NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_chat_company_created"
      ON "chat_messages" ("company_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_chat_unread"
      ON "chat_messages" ("company_id", "is_read")
      WHERE "is_read" = false AND "sender_type" IN ('manager','ai')
    `);

    // ── Enum типов уведомлений ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM (
        'date_proposed',         -- производитель предложил дату
        'date_confirmed',        -- дата согласована
        'pallet_window_open',    -- открылось окно сборки паллет
        'pallet_reminder_2d',    -- напоминание: 2 дня до дедлайна
        'pallet_reminder_1d',    -- напоминание: 1 день до дедлайна
        'pallet_window_closed',  -- окно закрыто
        'pallet_auto_assigned',  -- применено авто-распределение
        'invoice_issued',        -- инвойс выставлен
        'invoice_status_changed',-- статус оплаты изменён
        'order_shipped',         -- заказ отгружен
        'chat_new_message'       -- новое сообщение в чате
      )
    `);

    // ── notifications ─────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"          BIGSERIAL                    PRIMARY KEY,
        "user_id"     INTEGER                      NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE,
        "type"        "notification_type_enum"     NOT NULL,
        "title"       VARCHAR(255)                 NOT NULL,
        "body"        TEXT                         NOT NULL,

        "entity_type" VARCHAR(50),   -- 'order' | 'invoice' | 'chat'
        "entity_id"   INTEGER,

        "tg_message_id" BIGINT,

        "is_read"     BOOLEAN                      NOT NULL DEFAULT false,
        "sent_at"     TIMESTAMPTZ                  NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_unread"
      ON "notifications" ("user_id", "is_read", "sent_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_entity"
      ON "notifications" ("entity_type", "entity_id")
      WHERE "entity_type" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await queryRunner.query(`DROP TYPE  IF EXISTS "notification_type_enum"`);
    await queryRunner.query(`DROP TYPE  IF EXISTS "sender_type_enum"`);
  }
}
