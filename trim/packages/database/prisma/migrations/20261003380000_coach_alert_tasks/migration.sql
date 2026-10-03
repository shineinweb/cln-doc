-- AlterTable
ALTER TABLE `room_tasks` ADD COLUMN `source_alert_id` VARCHAR(191) NULL,
    ADD COLUMN `sop_record_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `room_tasks_source_alert_id_key` ON `room_tasks`(`source_alert_id`);

-- CreateIndex
CREATE INDEX `room_tasks_sop_record_id_idx` ON `room_tasks`(`sop_record_id`);

-- AddForeignKey
ALTER TABLE `room_tasks` ADD CONSTRAINT `room_tasks_source_alert_id_fkey` FOREIGN KEY (`source_alert_id`) REFERENCES `room_alerts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `room_tasks` ADD CONSTRAINT `room_tasks_sop_record_id_fkey` FOREIGN KEY (`sop_record_id`) REFERENCES `sop_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
