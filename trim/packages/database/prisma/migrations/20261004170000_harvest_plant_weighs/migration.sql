-- One scale weight per plant tag already on a harvest. A rescan replaces the row.
CREATE TABLE `harvest_plant_weighs` (
    `id` VARCHAR(191) NOT NULL,
    `harvest_id` VARCHAR(191) NOT NULL,
    `harvest_plant_id` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,
    `weight_grams` INTEGER NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `harvest_plant_weighs_harvest_plant_id_key`(`harvest_plant_id`),
    INDEX `harvest_plant_weighs_harvest_id_idx`(`harvest_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `harvest_plant_weighs` ADD CONSTRAINT `harvest_plant_weighs_harvest_id_fkey` FOREIGN KEY (`harvest_id`) REFERENCES `harvests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `harvest_plant_weighs` ADD CONSTRAINT `harvest_plant_weighs_harvest_plant_id_fkey` FOREIGN KEY (`harvest_plant_id`) REFERENCES `harvest_plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
