-- AlterTable
ALTER TABLE `plants` ADD COLUMN `voided_at` DATETIME(3) NULL,
    ADD COLUMN `voided_by_name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `harvests` ADD COLUMN `voided_at` DATETIME(3) NULL,
    ADD COLUMN `voided_by_name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `harvest_steps` ADD COLUMN `voided_at` DATETIME(3) NULL,
    ADD COLUMN `voided_by_name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `harvest_waste` ADD COLUMN `voided_at` DATETIME(3) NULL,
    ADD COLUMN `voided_by_name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `harvest_packages` ADD COLUMN `voided_at` DATETIME(3) NULL,
    ADD COLUMN `voided_by_name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `metrc_submissions` ADD COLUMN `voided_at` DATETIME(3) NULL,
    ADD COLUMN `voided_by_name` VARCHAR(191) NULL;
