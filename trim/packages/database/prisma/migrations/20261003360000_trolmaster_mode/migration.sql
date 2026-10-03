-- AlterTable
ALTER TABLE `rooms`
    ADD COLUMN `trolmaster_enabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `trolmaster_test` BOOLEAN NOT NULL DEFAULT false;
