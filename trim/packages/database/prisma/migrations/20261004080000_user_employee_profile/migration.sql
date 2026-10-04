-- Employee profile: phone, structured address, and photo object key.
ALTER TABLE `users`
  ADD COLUMN `phone` VARCHAR(40) NULL,
  ADD COLUMN `address_line1` VARCHAR(191) NULL,
  ADD COLUMN `city` VARCHAR(120) NULL,
  ADD COLUMN `region` VARCHAR(120) NULL,
  ADD COLUMN `postal_code` VARCHAR(32) NULL,
  ADD COLUMN `photo_object_key` VARCHAR(512) NULL;

CREATE UNIQUE INDEX `users_photo_object_key_key` ON `users`(`photo_object_key`);
