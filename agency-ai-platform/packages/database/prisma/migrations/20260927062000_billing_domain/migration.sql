-- Billing domain:
-- Products · Prices · Invoices · Subscriptions · Payments · Refund workflow · Webhooks

-- CreateTable
CREATE TABLE `products` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('ONE_TIME', 'RECURRING', 'SERVICE') NOT NULL DEFAULT 'SERVICE',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `products_key_key`(`key`),
    INDEX `products_active_type_idx`(`active`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prices` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `nickname` VARCHAR(200) NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `unit_cents` INTEGER NOT NULL,
    `interval` ENUM('ONE_TIME', 'MONTHLY', 'YEARLY') NOT NULL DEFAULT 'ONE_TIME',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `provider` VARCHAR(40) NULL,
    `external_id` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `prices_key_key`(`key`),
    INDEX `prices_product_id_active_idx`(`product_id`, `active`),
    INDEX `prices_interval_idx`(`interval`),
    UNIQUE INDEX `prices_provider_external_id_key`(`provider`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable invoices
ALTER TABLE `invoices` ADD COLUMN `provider` VARCHAR(40) NULL,
    ADD COLUMN `external_id` VARCHAR(120) NULL;
CREATE UNIQUE INDEX `invoices_provider_external_id_key` ON `invoices`(`provider`, `external_id`);

-- AlterTable invoice_line_items
ALTER TABLE `invoice_line_items` ADD COLUMN `product_id` CHAR(36) NULL,
    ADD COLUMN `price_id` CHAR(36) NULL;
CREATE INDEX `invoice_line_items_product_id_idx` ON `invoice_line_items`(`product_id`);
CREATE INDEX `invoice_line_items_price_id_idx` ON `invoice_line_items`(`price_id`);

-- AlterTable subscriptions
ALTER TABLE `subscriptions` ADD COLUMN `provider` VARCHAR(40) NULL,
    ADD COLUMN `external_id` VARCHAR(120) NULL;
CREATE UNIQUE INDEX `subscriptions_provider_external_id_key` ON `subscriptions`(`provider`, `external_id`);

-- AlterTable subscription_items
ALTER TABLE `subscription_items` ADD COLUMN `product_id` CHAR(36) NULL,
    ADD COLUMN `price_id` CHAR(36) NULL;
CREATE INDEX `subscription_items_product_id_idx` ON `subscription_items`(`product_id`);
CREATE INDEX `subscription_items_price_id_idx` ON `subscription_items`(`price_id`);

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NULL,
    `invoice_id` CHAR(36) NULL,
    `subscription_id` CHAR(36) NULL,
    `amount_cents` INTEGER NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `status` ENUM('PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `provider` VARCHAR(40) NOT NULL,
    `external_id` VARCHAR(120) NULL,
    `failure_code` VARCHAR(80) NULL,
    `failure_message` VARCHAR(500) NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payments_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `payments_status_created_at_idx`(`status`, `created_at`),
    INDEX `payments_invoice_id_idx`(`invoice_id`),
    INDEX `payments_subscription_id_idx`(`subscription_id`),
    INDEX `payments_customer_id_idx`(`customer_id`),
    UNIQUE INDEX `payments_provider_external_id_key`(`provider`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refunds` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NULL,
    `payment_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NULL,
    `amount_cents` INTEGER NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `status` ENUM('REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'DENIED', 'CANCELED') NOT NULL DEFAULT 'REQUESTED',
    `reason` VARCHAR(500) NULL,
    `provider` VARCHAR(40) NULL,
    `external_id` VARCHAR(120) NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_at` DATETIME(3) NULL,
    `processed_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `refunds_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `refunds_status_created_at_idx`(`status`, `created_at`),
    INDEX `refunds_payment_id_idx`(`payment_id`),
    INDEX `refunds_invoice_id_idx`(`invoice_id`),
    UNIQUE INDEX `refunds_provider_external_id_key`(`provider`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_methods` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `external_id` VARCHAR(120) NOT NULL,
    `brand` VARCHAR(40) NULL,
    `last4` CHAR(4) NULL,
    `exp_month` INTEGER NULL,
    `exp_year` INTEGER NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `payment_methods_organization_id_is_default_idx`(`organization_id`, `is_default`),
    UNIQUE INDEX `payment_methods_provider_external_id_key`(`provider`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_customers` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `external_id` VARCHAR(120) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `billing_customers_organization_id_key`(`organization_id`),
    UNIQUE INDEX `billing_customers_provider_external_id_key`(`provider`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` CHAR(36) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `event_type` VARCHAR(120) NOT NULL,
    `external_id` VARCHAR(190) NOT NULL,
    `status` ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED') NOT NULL DEFAULT 'RECEIVED',
    `payload_json` JSON NOT NULL,
    `error_message` VARCHAR(500) NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `webhook_events_status_received_at_idx`(`status`, `received_at`),
    INDEX `webhook_events_event_type_received_at_idx`(`event_type`, `received_at`),
    UNIQUE INDEX `webhook_events_provider_external_id_key`(`provider`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `prices` ADD CONSTRAINT `prices_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_line_items` ADD CONSTRAINT `invoice_line_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_line_items` ADD CONSTRAINT `invoice_line_items_price_id_fkey` FOREIGN KEY (`price_id`) REFERENCES `prices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_items` ADD CONSTRAINT `subscription_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_items` ADD CONSTRAINT `subscription_items_price_id_fkey` FOREIGN KEY (`price_id`) REFERENCES `prices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_customers` ADD CONSTRAINT `billing_customers_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
