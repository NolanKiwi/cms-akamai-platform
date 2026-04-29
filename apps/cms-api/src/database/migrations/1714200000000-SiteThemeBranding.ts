import { MigrationInterface, QueryRunner } from 'typeorm';

export class SiteThemeBranding1714200000000 implements MigrationInterface {
  name = 'SiteThemeBranding1714200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "description" text`);
    await queryRunner.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "theme" jsonb`);
    await queryRunner.query(`ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "branding" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "updated_at"`);
    await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "branding"`);
    await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "theme"`);
    await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "description"`);
  }
}
