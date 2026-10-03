-- CreateTable
CREATE TABLE `trolmaster_connections` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `controller_id` VARCHAR(191) NOT NULL,
    `api_credential` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `trolmaster_connections_room_id_key`(`room_id`),
    INDEX `trolmaster_connections_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trolmaster_connections` ADD CONSTRAINT `trolmaster_connections_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trolmaster_connections` ADD CONSTRAINT `trolmaster_connections_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
