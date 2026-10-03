-- CreateTable
CREATE TABLE `metrc_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `plant_event_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `sandbox_outcome` VARCHAR(191) NOT NULL,
    `requested_by_id` VARCHAR(191) NOT NULL,
    `requested_at` DATETIME(3) NOT NULL,
    `reviewer_id` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `rejection_note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `metrc_submissions_license_id_status_idx`(`license_id`, `status`),
    INDEX `metrc_submissions_plant_event_id_idx`(`plant_event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metrc_outbox` (
    `id` VARCHAR(191) NOT NULL,
    `submission_id` VARCHAR(191) NOT NULL,
    `license_id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `sandbox_outcome` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `metrc_outbox_submission_id_key`(`submission_id`),
    UNIQUE INDEX `metrc_outbox_request_id_key`(`request_id`),
    INDEX `metrc_outbox_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metrc_attempts` (
    `id` VARCHAR(191) NOT NULL,
    `submission_id` VARCHAR(191) NOT NULL,
    `outbox_id` VARCHAR(191) NOT NULL,
    `actor_user_id` VARCHAR(191) NOT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(500) NULL,
    `reconciliation_result` VARCHAR(191) NULL,
    `reconciled_at` DATETIME(3) NULL,
    `reconciled_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `metrc_attempts_submission_id_idx`(`submission_id`),
    INDEX `metrc_attempts_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `metrc_submissions` ADD CONSTRAINT `metrc_submissions_license_id_fkey` FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_submissions` ADD CONSTRAINT `metrc_submissions_plant_event_id_fkey` FOREIGN KEY (`plant_event_id`) REFERENCES `plant_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_submissions` ADD CONSTRAINT `metrc_submissions_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_submissions` ADD CONSTRAINT `metrc_submissions_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_outbox` ADD CONSTRAINT `metrc_outbox_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `metrc_submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_outbox` ADD CONSTRAINT `metrc_outbox_license_id_fkey` FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_attempts` ADD CONSTRAINT `metrc_attempts_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `metrc_submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_attempts` ADD CONSTRAINT `metrc_attempts_outbox_id_fkey` FOREIGN KEY (`outbox_id`) REFERENCES `metrc_outbox`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_attempts` ADD CONSTRAINT `metrc_attempts_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metrc_attempts` ADD CONSTRAINT `metrc_attempts_reconciled_by_id_fkey` FOREIGN KEY (`reconciled_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

