-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `title` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL;

-- CreateTable
CREATE TABLE `metrc_api_settings` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `integrator_api_key` TEXT NOT NULL,
    `user_api_key` TEXT NOT NULL,
    `license_number` VARCHAR(191) NOT NULL DEFAULT '',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `metrc_api_settings_organization_id_key`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `metrc_api_settings` ADD CONSTRAINT `metrc_api_settings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
