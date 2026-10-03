-- CreateTable
CREATE TABLE `sensor_gateways` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sensor_gateways_site_id_idx`(`site_id`),
    UNIQUE INDEX `sensor_gateways_site_id_name_key`(`site_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `controller_readings` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `metric` VARCHAR(191) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL,
    `quality` VARCHAR(191) NOT NULL,
    `is_sample` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `controller_readings_room_id_recorded_at_idx`(`room_id`, `recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scale_samples` (
    `id` VARCHAR(191) NOT NULL,
    `harvest_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `weight_grams` INTEGER NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL,
    `quality` VARCHAR(191) NOT NULL,
    `is_sample` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scale_samples_harvest_id_recorded_at_idx`(`harvest_id`, `recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sensor_gateways` ADD CONSTRAINT `sensor_gateways_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `controller_readings` ADD CONSTRAINT `controller_readings_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scale_samples` ADD CONSTRAINT `scale_samples_harvest_id_fkey` FOREIGN KEY (`harvest_id`) REFERENCES `harvests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
