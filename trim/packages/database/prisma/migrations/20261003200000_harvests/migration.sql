-- AlterTable
ALTER TABLE `metrc_submissions` MODIFY `plant_event_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `harvests` (
    `id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `cycle_id` VARCHAR(191) NULL,
    `room_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `harvests_license_id_idx`(`license_id`),
    INDEX `harvests_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `harvest_plants` (
    `id` VARCHAR(191) NOT NULL,
    `harvest_id` VARCHAR(191) NOT NULL,
    `plant_id` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `harvest_plants_plant_id_key`(`plant_id`),
    UNIQUE INDEX `harvest_plants_harvest_id_tag_key`(`harvest_id`, `tag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `harvest_steps` (
    `id` VARCHAR(191) NOT NULL,
    `harvest_id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `actor_user_id` VARCHAR(191) NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `weight_grams` INTEGER NULL,
    `room_id` VARCHAR(191) NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `harvest_steps_harvest_id_occurred_at_idx`(`harvest_id`, `occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `harvest_waste` (
    `id` VARCHAR(191) NOT NULL,
    `harvest_id` VARCHAR(191) NOT NULL,
    `weight_grams` INTEGER NOT NULL,
    `note` VARCHAR(500) NULL,
    `actor_user_id` VARCHAR(191) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `harvest_waste_harvest_id_idx`(`harvest_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `harvest_packages` (
    `id` VARCHAR(191) NOT NULL,
    `harvest_id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `weight_grams` INTEGER NOT NULL,
    `actor_user_id` VARCHAR(191) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `harvest_packages_license_id_label_key`(`license_id`, `label`),
    INDEX `harvest_packages_harvest_id_idx`(`harvest_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `harvest_package_plants` (
    `id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NOT NULL,
    `harvest_plant_id` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `harvest_package_plants_package_id_harvest_plant_id_key`(`package_id`, `harvest_plant_id`),
    INDEX `harvest_package_plants_harvest_plant_id_idx`(`harvest_plant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `metrc_submissions` ADD COLUMN `package_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `metrc_submissions_package_id_idx` ON `metrc_submissions`(`package_id`);

-- AddForeignKey
ALTER TABLE `harvests` ADD CONSTRAINT `harvests_license_id_fkey` FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `harvests` ADD CONSTRAINT `harvests_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `harvests` ADD CONSTRAINT `harvests_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `crop_cycles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `harvests` ADD CONSTRAINT `harvests_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `harvest_plants` ADD CONSTRAINT `harvest_plants_harvest_id_fkey` FOREIGN KEY (`harvest_id`) REFERENCES `harvests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `harvest_plants` ADD CONSTRAINT `harvest_plants_plant_id_fkey` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `harvest_steps` ADD CONSTRAINT `harvest_steps_harvest_id_fkey` FOREIGN KEY (`harvest_id`) REFERENCES `harvests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `harvest_steps` ADD CONSTRAINT `harvest_steps_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `harvest_steps` ADD CONSTRAINT `harvest_steps_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `harvest_waste` ADD CONSTRAINT `harvest_waste_harvest_id_fkey` FOREIGN KEY (`harvest_id`) REFERENCES `harvests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `harvest_waste` ADD CONSTRAINT `harvest_waste_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `harvest_packages` ADD CONSTRAINT `harvest_packages_harvest_id_fkey` FOREIGN KEY (`harvest_id`) REFERENCES `harvests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `harvest_packages` ADD CONSTRAINT `harvest_packages_license_id_fkey` FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `harvest_packages` ADD CONSTRAINT `harvest_packages_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `harvest_package_plants` ADD CONSTRAINT `harvest_package_plants_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `harvest_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `harvest_package_plants` ADD CONSTRAINT `harvest_package_plants_harvest_plant_id_fkey` FOREIGN KEY (`harvest_plant_id`) REFERENCES `harvest_plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `metrc_submissions` ADD CONSTRAINT `metrc_submissions_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `harvest_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
