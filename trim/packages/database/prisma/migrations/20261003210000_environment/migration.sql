-- AlterTable
ALTER TABLE `rooms` ADD COLUMN `stale_after_minutes` INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE `environmental_readings` ADD COLUMN `device_id` VARCHAR(191) NOT NULL DEFAULT 'unspecified',
    ADD COLUMN `quality` VARCHAR(191) NOT NULL DEFAULT 'good';

-- CreateIndex
CREATE INDEX `environmental_readings_room_id_metric_recorded_at_idx` ON `environmental_readings`(`room_id`, `metric`, `recorded_at`);

-- CreateTable
CREATE TABLE `alert_rules` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `metric` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `min_value` DECIMAL(10, 2) NULL,
    `max_value` DECIMAL(10, 2) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `alert_rules_room_id_idx`(`room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `room_alerts` ADD COLUMN `rule_id` VARCHAR(191) NULL,
    ADD COLUMN `metric` VARCHAR(191) NULL,
    ADD COLUMN `kind` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `room_alerts_rule_id_idx` ON `room_alerts`(`rule_id`);

-- AddForeignKey
ALTER TABLE `alert_rules` ADD CONSTRAINT `alert_rules_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_alerts` ADD CONSTRAINT `room_alerts_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `alert_rules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
