-- Project status pipeline:
-- New → Planning → Design → Development → Customer Review → Revision → QA → Launch → Maintenance

-- Expand enum to accept both legacy and new values
ALTER TABLE `projects` MODIFY `status` ENUM(
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
  'NEW',
  'DESIGN',
  'DEVELOPMENT',
  'CUSTOMER_REVIEW',
  'REVISION',
  'QA',
  'LAUNCH',
  'MAINTENANCE'
) NOT NULL DEFAULT 'PLANNING';

-- Remap legacy operational statuses onto the delivery pipeline
UPDATE `projects` SET `status` = 'DEVELOPMENT' WHERE `status` = 'ACTIVE';
UPDATE `projects` SET `status` = 'PLANNING' WHERE `status` = 'ON_HOLD';
UPDATE `projects` SET `status` = 'LAUNCH' WHERE `status` = 'COMPLETED';
UPDATE `projects` SET `status` = 'NEW' WHERE `status` = 'CANCELLED';

-- Shrink enum to the canonical pipeline; default New
ALTER TABLE `projects` MODIFY `status` ENUM(
  'NEW',
  'PLANNING',
  'DESIGN',
  'DEVELOPMENT',
  'CUSTOMER_REVIEW',
  'REVISION',
  'QA',
  'LAUNCH',
  'MAINTENANCE'
) NOT NULL DEFAULT 'NEW';
