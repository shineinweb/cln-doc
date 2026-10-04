-- Grant the day-to-day module set to facility_associate roles (demo Blake account).
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`, `created_at`, `updated_at`)
SELECT r.`id`, p.`id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`key` = 'facility_associate' AND p.`key` IN ('dashboard.read', 'organization.read', 'facilities.read', 'sites.read', 'rooms.read', 'rooms.write', 'zones.read', 'zones.write', 'tasks.read', 'tasks.write', 'timeclock.punch', 'compliance.read', 'compliance.write', 'harvests.read', 'harvests.write', 'operations.read', 'operations.write', 'reports.read', 'coach.use', 'messages.use', 'inventory.read', 'inventory.write');
