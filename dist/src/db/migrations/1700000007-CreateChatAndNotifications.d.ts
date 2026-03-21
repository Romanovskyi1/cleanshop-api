import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class CreateChatAndNotifications1700000007000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
