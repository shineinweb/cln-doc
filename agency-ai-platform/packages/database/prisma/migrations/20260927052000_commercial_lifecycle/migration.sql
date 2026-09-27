-- Commercial lifecycle:
-- Lead → Opportunity → Quote → Customer → Project → Invoice → Recurring Services

-- CreateTable
CREATE TABLE `leads` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NULL,
    `owner_user_id` CHAR(36) NULL,
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED') NOT NULL DEFAULT 'NEW',
    `source` VARCHAR(80) NULL,
    `company_name` VARCHAR(200) NULL,
    `contact_name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `title` VARCHAR(200) NULL,
    `notes` TEXT NULL,
    `converted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `leads_status_created_at_idx`(`status`, `created_at`),
    INDEX `leads_email_idx`(`email`),
    INDEX `leads_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `leads_owner_user_id_idx`(`owner_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_activities` (
    `id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `actor_user_id` CHAR(36) NULL,
    `type` ENUM('NOTE', 'CALL', 'EMAIL', 'STATUS_CHANGE', 'MEETING') NOT NULL DEFAULT 'NOTE',
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_activities_lead_id_created_at_idx`(`lead_id`, `created_at`),
    INDEX `lead_activities_actor_user_id_idx`(`actor_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opportunities` (
    `id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NULL,
    `organization_id` CHAR(36) NULL,
    `owner_user_id` CHAR(36) NULL,
    `name` VARCHAR(200) NOT NULL,
    `stage` ENUM('QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST') NOT NULL DEFAULT 'QUALIFICATION',
    `amount_cents` INTEGER NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `expected_close` DATETIME(3) NULL,
    `won_at` DATETIME(3) NULL,
    `lost_at` DATETIME(3) NULL,
    `loss_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `opportunities_stage_created_at_idx`(`stage`, `created_at`),
    INDEX `opportunities_lead_id_idx`(`lead_id`),
    INDEX `opportunities_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `opportunities_owner_user_id_idx`(`owner_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotes` (
    `id` CHAR(36) NOT NULL,
    `opportunity_id` CHAR(36) NULL,
    `organization_id` CHAR(36) NULL,
    `number` VARCHAR(40) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `subtotal_cents` INTEGER NOT NULL DEFAULT 0,
    `tax_cents` INTEGER NOT NULL DEFAULT 0,
    `total_cents` INTEGER NOT NULL DEFAULT 0,
    `valid_until` DATETIME(3) NULL,
    `sent_at` DATETIME(3) NULL,
    `accepted_at` DATETIME(3) NULL,
    `rejected_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `quotes_number_key`(`number`),
    INDEX `quotes_status_created_at_idx`(`status`, `created_at`),
    INDEX `quotes_opportunity_id_idx`(`opportunity_id`),
    INDEX `quotes_organization_id_created_at_idx`(`organization_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_line_items` (
    `id` CHAR(36) NOT NULL,
    `quote_id` CHAR(36) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(500) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1,
    `unit_cents` INTEGER NOT NULL,
    `total_cents` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quote_line_items_quote_id_sort_order_idx`(`quote_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NULL,
    `quote_id` CHAR(36) NULL,
    `owner_user_id` CHAR(36) NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNING',
    `starts_at` DATETIME(3) NULL,
    `due_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `summary` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `projects_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `projects_status_created_at_idx`(`status`, `created_at`),
    INDEX `projects_customer_id_idx`(`customer_id`),
    INDEX `projects_quote_id_idx`(`quote_id`),
    INDEX `projects_owner_user_id_idx`(`owner_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NULL,
    `project_id` CHAR(36) NULL,
    `quote_id` CHAR(36) NULL,
    `number` VARCHAR(40) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID', 'OVERDUE') NOT NULL DEFAULT 'DRAFT',
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `subtotal_cents` INTEGER NOT NULL DEFAULT 0,
    `tax_cents` INTEGER NOT NULL DEFAULT 0,
    `total_cents` INTEGER NOT NULL DEFAULT 0,
    `amount_paid_cents` INTEGER NOT NULL DEFAULT 0,
    `issued_at` DATETIME(3) NULL,
    `due_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `invoices_number_key`(`number`),
    INDEX `invoices_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `invoices_status_created_at_idx`(`status`, `created_at`),
    INDEX `invoices_customer_id_idx`(`customer_id`),
    INDEX `invoices_project_id_idx`(`project_id`),
    INDEX `invoices_quote_id_idx`(`quote_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_line_items` (
    `id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(500) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1,
    `unit_cents` INTEGER NOT NULL,
    `total_cents` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `invoice_line_items_invoice_id_sort_order_idx`(`invoice_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NULL,
    `project_id` CHAR(36) NULL,
    `quote_id` CHAR(36) NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED') NOT NULL DEFAULT 'TRIALING',
    `interval` ENUM('MONTHLY', 'YEARLY') NOT NULL DEFAULT 'MONTHLY',
    `amount_cents` INTEGER NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'USD',
    `current_period_start` DATETIME(3) NULL,
    `current_period_end` DATETIME(3) NULL,
    `cancel_at` DATETIME(3) NULL,
    `canceled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `subscriptions_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `subscriptions_status_created_at_idx`(`status`, `created_at`),
    INDEX `subscriptions_customer_id_idx`(`customer_id`),
    INDEX `subscriptions_project_id_idx`(`project_id`),
    INDEX `subscriptions_quote_id_idx`(`quote_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_items` (
    `id` CHAR(36) NOT NULL,
    `subscription_id` CHAR(36) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(500) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1,
    `unit_cents` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscription_items_subscription_id_sort_order_idx`(`subscription_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_opportunity_id_fkey` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_line_items` ADD CONSTRAINT `quote_line_items_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_line_items` ADD CONSTRAINT `invoice_line_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_items` ADD CONSTRAINT `subscription_items_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
