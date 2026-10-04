-- Password reset, email notification preference, and admin email broadcasts.
ALTER TABLE `users` ADD COLUMN `email_notifications_enabled` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    INDEX `password_reset_tokens_token_hash_idx`(`token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `email_broadcasts` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `body` TEXT NOT NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `recipient_count` INTEGER NOT NULL DEFAULT 0,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `email_broadcasts_organization_id_created_at_idx`(`organization_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `email_broadcast_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `broadcast_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `error` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `email_broadcast_recipients_broadcast_id_idx`(`broadcast_id`),
    INDEX `email_broadcast_recipients_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `email_broadcasts` ADD CONSTRAINT `email_broadcasts_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `email_broadcasts` ADD CONSTRAINT `email_broadcasts_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `email_broadcast_recipients` ADD CONSTRAINT `email_broadcast_recipients_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `email_broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `email_broadcast_recipients` ADD CONSTRAINT `email_broadcast_recipients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT REPLACE(UUID(), '-', ''), 'communications.manage', 'Send organization email announcements and marketing broadcasts', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'communications.manage');

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`key` = 'org_admin' AND p.`key` = 'communications.manage';
