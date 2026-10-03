-- AlterTable
ALTER TABLE `workflow_templates` ADD COLUMN `cultivar` VARCHAR(191) NULL,
    ADD COLUMN `medium` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `harvest_tag_samples` (
    `id` VARCHAR(191) NOT NULL,
    `harvest_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL,
    `quality` VARCHAR(191) NOT NULL,
    `is_sample` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `harvest_tag_samples_harvest_id_recorded_at_idx`(`harvest_id`, `recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `irrigation_records` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `recorded_on` DATE NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `volume_liters` DECIMAL(8, 2) NULL,
    `ec` DECIMAL(4, 2) NULL,
    `ph` DECIMAL(4, 2) NULL,
    `nutrient_name` VARCHAR(191) NULL,
    `note` VARCHAR(500) NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `irrigation_records_site_id_recorded_on_idx`(`site_id`, `recorded_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ipm_records` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `recorded_on` DATE NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `finding` VARCHAR(191) NOT NULL,
    `response` VARCHAR(191) NOT NULL,
    `note` VARCHAR(500) NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ipm_records_site_id_recorded_on_idx`(`site_id`, `recorded_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_records` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NULL,
    `recorded_on` DATE NOT NULL,
    `asset_name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(500) NOT NULL,
    `next_due_on` DATE NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `maintenance_records_site_id_recorded_on_idx`(`site_id`, `recorded_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_records` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `vendor_name` VARCHAR(191) NOT NULL,
    `ordered_on` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(8, 2) NOT NULL,
    `unit_cost_cents` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `purchase_records_site_id_ordered_on_idx`(`site_id`, `ordered_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sanitation_records` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `recorded_on` DATE NOT NULL,
    `area` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sanitation_records_site_id_recorded_on_idx`(`site_id`, `recorded_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `training_records` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `trainee_name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `sop_title` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `completed_on` DATE NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `training_records_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `room_stays` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `cultivar` VARCHAR(191) NOT NULL,
    `medium` VARCHAR(191) NOT NULL,
    `starts_on` DATE NOT NULL,
    `ends_on` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `room_stays_site_id_starts_on_idx`(`site_id`, `starts_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recurring_duties` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `cadence` VARCHAR(191) NOT NULL,
    `next_due_on` DATE NOT NULL,
    `assignee_label` VARCHAR(191) NOT NULL,
    `sop_title` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `recurring_duties_site_id_next_due_on_idx`(`site_id`, `next_due_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `harvest_tag_samples` ADD CONSTRAINT `harvest_tag_samples_harvest_id_fkey` FOREIGN KEY (`harvest_id`) REFERENCES `harvests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `irrigation_records` ADD CONSTRAINT `irrigation_records_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `irrigation_records` ADD CONSTRAINT `irrigation_records_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ipm_records` ADD CONSTRAINT `ipm_records_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ipm_records` ADD CONSTRAINT `ipm_records_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_records` ADD CONSTRAINT `maintenance_records_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_records` ADD CONSTRAINT `maintenance_records_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_records` ADD CONSTRAINT `purchase_records_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sanitation_records` ADD CONSTRAINT `sanitation_records_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sanitation_records` ADD CONSTRAINT `sanitation_records_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `training_records` ADD CONSTRAINT `training_records_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_stays` ADD CONSTRAINT `room_stays_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_stays` ADD CONSTRAINT `room_stays_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_duties` ADD CONSTRAINT `recurring_duties_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_duties` ADD CONSTRAINT `recurring_duties_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

