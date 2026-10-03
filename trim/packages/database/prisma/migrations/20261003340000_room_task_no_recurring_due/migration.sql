-- AlterTable
ALTER TABLE `room_tasks` MODIFY `due_on` DATE NULL;

-- Recurring tasks keep their days and do not store a due date.
UPDATE `room_tasks` SET `due_on` = NULL WHERE `kind` = 'recurring';
