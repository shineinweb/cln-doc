-- CreateTable
CREATE TABLE `time_punches` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `punched_at` DATETIME(3) NOT NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `time_punches_organization_id_punched_at_idx`(`organization_id`, `punched_at`),
    INDEX `time_punches_user_id_punched_at_idx`(`user_id`, `punched_at`),
    INDEX `time_punches_site_id_punched_at_idx`(`site_id`, `punched_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `time_punches` ADD CONSTRAINT `time_punches_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_punches` ADD CONSTRAINT `time_punches_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_punches` ADD CONSTRAINT `time_punches_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
