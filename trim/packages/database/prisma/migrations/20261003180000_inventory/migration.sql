-- CreateTable
CREATE TABLE `strains` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `strains_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `strains_organization_id_name_key`(`organization_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plant_batches` (
    `id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `strain_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `plant_batches_strain_id_idx`(`strain_id`),
    UNIQUE INDEX `plant_batches_license_id_name_key`(`license_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plants` (
    `id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NOT NULL,
    `strain_id` VARCHAR(191) NOT NULL,
    `cycle_id` VARCHAR(191) NULL,
    `room_id` VARCHAR(191) NULL,
    `tag` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `plants_cycle_id_idx`(`cycle_id`),
    INDEX `plants_room_id_idx`(`room_id`),
    INDEX `plants_batch_id_idx`(`batch_id`),
    UNIQUE INDEX `plants_license_id_tag_key`(`license_id`, `tag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plant_events` (
    `id` VARCHAR(191) NOT NULL,
    `plant_id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(191) NOT NULL,
    `actor_user_id` VARCHAR(191) NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `from_room_id` VARCHAR(191) NULL,
    `to_room_id` VARCHAR(191) NULL,
    `from_stage` VARCHAR(191) NULL,
    `to_stage` VARCHAR(191) NULL,
    `note` VARCHAR(2000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `plant_events_plant_id_occurred_at_idx`(`plant_id`, `occurred_at`),
    INDEX `plant_events_license_id_idx`(`license_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metrc_connections` (
    `id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `integrator_key` VARCHAR(255) NOT NULL,
    `user_key` VARCHAR(255) NOT NULL,
    `base_url` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `metrc_connections_license_id_key`(`license_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metrc_inventory_imports` (
    `id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `matched_count` INTEGER NOT NULL,
    `discrepancy_count` INTEGER NOT NULL,
    `imported_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `metrc_inventory_imports_license_id_imported_at_idx`(`license_id`, `imported_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metrc_discrepancies` (
    `id` VARCHAR(191) NOT NULL,
    `import_id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `metrc_discrepancies_import_id_idx`(`import_id`),
    INDEX `metrc_discrepancies_license_id_idx`(`license_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `strains` ADD CONSTRAINT `strains_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plant_batches` ADD CONSTRAINT `plant_batches_license_id_fkey` FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plant_batches` ADD CONSTRAINT `plant_batches_strain_id_fkey` FOREIGN KEY (`strain_id`) REFERENCES `strains`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plants` ADD CONSTRAINT `plants_license_id_fkey` FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plants` ADD CONSTRAINT `plants_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `plant_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plants` ADD CONSTRAINT `plants_strain_id_fkey` FOREIGN KEY (`strain_id`) REFERENCES `strains`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plants` ADD CONSTRAINT `plants_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `crop_cycles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plants` ADD CONSTRAINT `plants_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plant_events` ADD CONSTRAINT `plant_events_plant_id_fkey` FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plant_events` ADD CONSTRAINT `plant_events_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_connections` ADD CONSTRAINT `metrc_connections_license_id_fkey` FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_inventory_imports` ADD CONSTRAINT `metrc_inventory_imports_license_id_fkey` FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_discrepancies` ADD CONSTRAINT `metrc_discrepancies_import_id_fkey` FOREIGN KEY (`import_id`) REFERENCES `metrc_inventory_imports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_discrepancies` ADD CONSTRAINT `metrc_discrepancies_license_id_fkey` FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

