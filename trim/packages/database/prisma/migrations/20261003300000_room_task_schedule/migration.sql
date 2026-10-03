-- AlterTable
ALTER TABLE `room_tasks`
    ADD COLUMN `kind` VARCHAR(32) NOT NULL DEFAULT 'one_time',
    ADD COLUMN `cadence` VARCHAR(32) NULL,
    ADD COLUMN `assignee_user_id` VARCHAR(191) NULL,
    ADD COLUMN `assignee_label` VARCHAR(191) NOT NULL DEFAULT 'Unassigned';

-- CreateIndex
CREATE INDEX `room_tasks_assignee_user_id_idx` ON `room_tasks`(`assignee_user_id`);

-- AddForeignKey
ALTER TABLE `room_tasks` ADD CONSTRAINT `room_tasks_assignee_user_id_fkey` FOREIGN KEY (`assignee_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
