-- Expand the global permission catalog and grant defaults to org_admin / site_operator roles.

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_dashboard_read', 'dashboard.read', 'Open the main dashboard', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'dashboard.read');
UPDATE `permissions` SET `description` = 'Open the main dashboard', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'dashboard.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_access_manage', 'access.manage', 'Manage users, roles, permissions, and view the full audit log', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'access.manage');
UPDATE `permissions` SET `description` = 'Manage users, roles, permissions, and view the full audit log', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'access.manage';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_organization_read', 'organization.read', 'View the organization profile', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'organization.read');
UPDATE `permissions` SET `description` = 'View the organization profile', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'organization.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_facilities_read', 'facilities.read', 'View facilities', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'facilities.read');
UPDATE `permissions` SET `description` = 'View facilities', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'facilities.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_facilities_write', 'facilities.write', 'Add, edit, or delete facilities', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'facilities.write');
UPDATE `permissions` SET `description` = 'Add, edit, or delete facilities', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'facilities.write';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_sites_read', 'sites.read', 'View facilities the user is allowed to open', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'sites.read');
UPDATE `permissions` SET `description` = 'View facilities the user is allowed to open', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'sites.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_rooms_read', 'rooms.read', 'View rooms inside an authorized facility', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'rooms.read');
UPDATE `permissions` SET `description` = 'View rooms inside an authorized facility', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'rooms.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_rooms_write', 'rooms.write', 'Add, edit, reset, or delete rooms and room settings', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'rooms.write');
UPDATE `permissions` SET `description` = 'Add, edit, reset, or delete rooms and room settings', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'rooms.write';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_zones_read', 'zones.read', 'View zones inside an authorized room', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'zones.read');
UPDATE `permissions` SET `description` = 'View zones inside an authorized room', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'zones.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_zones_write', 'zones.write', 'Add, edit, or delete zones', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'zones.write');
UPDATE `permissions` SET `description` = 'Add, edit, or delete zones', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'zones.write';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_tasks_read', 'tasks.read', 'View crop-cycle, room, and workspace tasks', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'tasks.read');
UPDATE `permissions` SET `description` = 'View crop-cycle, room, and workspace tasks', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'tasks.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_tasks_write', 'tasks.write', 'Create, edit, or complete tasks', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'tasks.write');
UPDATE `permissions` SET `description` = 'Create, edit, or complete tasks', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'tasks.write';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_timeclock_punch', 'timeclock.punch', 'Clock in, lunch, and clock out', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'timeclock.punch');
UPDATE `permissions` SET `description` = 'Clock in, lunch, and clock out', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'timeclock.punch';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_timeclock_manage', 'timeclock.manage', 'View payroll, set labor rates, and ask AI payroll', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'timeclock.manage');
UPDATE `permissions` SET `description` = 'View payroll, set labor rates, and ask AI payroll', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'timeclock.manage';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_compliance_read', 'compliance.read', 'View compliance and Metrc submissions', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'compliance.read');
UPDATE `permissions` SET `description` = 'View compliance and Metrc submissions', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'compliance.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_compliance_write', 'compliance.write', 'Create or change compliance submissions', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'compliance.write');
UPDATE `permissions` SET `description` = 'Create or change compliance submissions', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'compliance.write';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_harvests_read', 'harvests.read', 'View harvests and packages', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'harvests.read');
UPDATE `permissions` SET `description` = 'View harvests and packages', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'harvests.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_harvests_write', 'harvests.write', 'Record or change harvests and packages', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'harvests.write');
UPDATE `permissions` SET `description` = 'Record or change harvests and packages', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'harvests.write';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_operations_read', 'operations.read', 'View Operations lists', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'operations.read');
UPDATE `permissions` SET `description` = 'View Operations lists', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'operations.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_operations_write', 'operations.write', 'Add or change Operations records', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'operations.write');
UPDATE `permissions` SET `description` = 'Add or change Operations records', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'operations.write';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_reports_read', 'reports.read', 'View reports and dashboard analytics', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'reports.read');
UPDATE `permissions` SET `description` = 'View reports and dashboard analytics', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'reports.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_coach_use', 'coach.use', 'Use the AI helper', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'coach.use');
UPDATE `permissions` SET `description` = 'Use the AI helper', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'coach.use';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_messages_use', 'messages.use', 'Send and read internal messages', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'messages.use');
UPDATE `permissions` SET `description` = 'Send and read internal messages', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'messages.use';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_settings_manage', 'settings.manage', 'Change organization settings and API credentials', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'settings.manage');
UPDATE `permissions` SET `description` = 'Change organization settings and API credentials', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'settings.manage';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_workflows_manage', 'workflows.manage', 'Manage workflow templates and teams', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'workflows.manage');
UPDATE `permissions` SET `description` = 'Manage workflow templates and teams', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'workflows.manage';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_inventory_read', 'inventory.read', 'View plants and license inventory', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'inventory.read');
UPDATE `permissions` SET `description` = 'View plants and license inventory', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'inventory.read';

INSERT INTO `permissions` (`id`, `key`, `description`, `created_at`, `updated_at`)
SELECT 'perm_inventory_write', 'inventory.write', 'Change plants and license inventory', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `key` = 'inventory.write');
UPDATE `permissions` SET `description` = 'Change plants and license inventory', `updated_at` = CURRENT_TIMESTAMP(3) WHERE `key` = 'inventory.write';

-- Org-wide admin roles receive every catalog permission.
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`key` = 'org_admin';

-- Site operators receive the day-to-day module set (not access, settings, workflows, or payroll manage).
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`key` = 'site_operator' AND p.`key` IN ('coach.use', 'compliance.read', 'compliance.write', 'dashboard.read', 'facilities.read', 'harvests.read', 'harvests.write', 'inventory.read', 'inventory.write', 'messages.use', 'operations.read', 'operations.write', 'organization.read', 'reports.read', 'rooms.read', 'rooms.write', 'sites.read', 'tasks.read', 'tasks.write', 'timeclock.punch', 'zones.read', 'zones.write');

