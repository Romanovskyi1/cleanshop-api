import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPalletWeightCheckConstraint1700000013 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        violations INT;
      BEGIN
        SELECT COUNT(*) INTO violations FROM pallets WHERE total_weight_kg > 1000;
        IF violations > 0 THEN
          RAISE EXCEPTION 'Cannot add CHECK constraint: % pallets exceed 1000 kg. Fix data first.', violations;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE pallets
        ADD CONSTRAINT chk_pallet_total_weight_max
        CHECK (total_weight_kg <= 1000)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE pallets DROP CONSTRAINT IF EXISTS chk_pallet_total_weight_max
    `);
  }
}
