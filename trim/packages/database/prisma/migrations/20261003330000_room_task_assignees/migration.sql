-- CreateTable
CREATE TABLE `room_task_assignees` (
    `room_task_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,

    INDEX `room_task_assignees_user_id_idx`(`user_id`),
    PRIMARY KEY (`room_task_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Copy the existing single assignee onto the new list.
INSERT INTO `room_task_assignees` (`room_task_id`, `user_id`)
SELECT `id`, `assignee_user_id` FROM `room_tasks` WHERE `assignee_user_id` IS NOT NULL;

-- AddForeignKey
ALTER TABLE `room_task_assignees` ADD CONSTRAINT `room_task_assignees_room_task_id_fkey` FOREIGN KEY (`room_task_id`) REFERENCES `room_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `room_task_assignees` ADD CONSTRAINT `room_task_assignees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the single-assignee columns.
ALTER TABLE `room_tasks` DROP FOREIGN KEY `room_tasks_assignee_user_id_fkey`;
DROP INDEX `room_tasks_assignee_user_id_idx` ON `room_tasks`;
ALTER TABLE `room_tasks` DROP COLUMN `assignee_user_id`, DROP COLUMN `assignee_label`;
