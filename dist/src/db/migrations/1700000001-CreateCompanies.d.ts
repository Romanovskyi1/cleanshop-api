import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class CreateCompanies1700000001000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
