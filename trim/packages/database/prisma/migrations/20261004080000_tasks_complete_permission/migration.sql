-- Split task completion from create/edit.
INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_tasks_complete', 'tasks.complete', 'Mark tasks finished', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'tasks.complete');
UPDATE `permissions` SET `description` = 'Mark tasks finished', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'tasks.complete';
UPDATE `permissions` SET `description` = 'Create or edit tasks', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'tasks.write';

-- Roles that already create/edit tasks also keep the ability to finish them.
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT rp.`role_id`, complete.`id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `role_permissions` rp
INNER JOIN `permissions` write_perm ON write_perm.`id` = rp.`permission_id` AND write_perm.`key` = 'tasks.write'
CROSS JOIN `permissions` complete
WHERE complete.`key` = 'tasks.complete';
