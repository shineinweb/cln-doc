-- Quote customer actions: View · Accept · Reject · Request changes

ALTER TABLE `quotes` MODIFY `status` ENUM(
  'DRAFT',
  'SENT',
  'CHANGES_REQUESTED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED'
) NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `quotes` ADD COLUMN `viewed_at` DATETIME(3) NULL;
ALTER TABLE `quotes` ADD COLUMN `changes_requested_at` DATETIME(3) NULL;
ALTER TABLE `quotes` ADD COLUMN `customer_message` TEXT NULL;
