-- Support domain:
-- SupportTicket → TicketMessage → TicketAttachment (+ TicketAssignment, TicketStatusHistory)
-- Status: Open → Pending → Customer Reply → Escalated → Resolved → Closed

-- CreateTable
CREATE TABLE `support_tickets` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NULL,
    `requester_user_id` CHAR(36) NULL,
    `number` INTEGER NOT NULL AUTO_INCREMENT,
    `subject` VARCHAR(300) NOT NULL,
    `status` ENUM('OPEN', 'PENDING', 'CUSTOMER_REPLY', 'ESCALATED', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `category` VARCHAR(80) NULL,
    `first_response_due_at` DATETIME(3) NULL,
    `resolution_due_at` DATETIME(3) NULL,
    `first_responded_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `support_tickets_number_key`(`number`),
    INDEX `support_tickets_organization_id_status_updated_at_idx`(`organization_id`, `status`, `updated_at`),
    INDEX `support_tickets_customer_id_idx`(`customer_id`),
    INDEX `support_tickets_requester_user_id_idx`(`requester_user_id`),
    INDEX `support_tickets_priority_status_idx`(`priority`, `status`),
    INDEX `support_tickets_first_response_due_at_idx`(`first_response_due_at`),
    INDEX `support_tickets_resolution_due_at_idx`(`resolution_due_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_messages` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NOT NULL,
    `author_user_id` CHAR(36) NULL,
    `author_type` ENUM('CUSTOMER', 'STAFF', 'AI', 'SYSTEM') NOT NULL DEFAULT 'CUSTOMER',
    `body` TEXT NOT NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `ticket_messages_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
    INDEX `ticket_messages_author_user_id_idx`(`author_user_id`),
    INDEX `ticket_messages_author_type_idx`(`author_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_attachments` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NOT NULL,
    `message_id` CHAR(36) NULL,
    `uploaded_by_user_id` CHAR(36) NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `storage_key` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `ticket_attachments_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
    INDEX `ticket_attachments_message_id_idx`(`message_id`),
    INDEX `ticket_attachments_uploaded_by_user_id_idx`(`uploaded_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_assignments` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NOT NULL,
    `assignee_user_id` CHAR(36) NOT NULL,
    `assigned_by_user_id` CHAR(36) NULL,
    `role` ENUM('PRIMARY', 'COLLABORATOR', 'WATCHER') NOT NULL DEFAULT 'PRIMARY',
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unassigned_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ticket_assignments_ticket_id_role_idx`(`ticket_id`, `role`),
    INDEX `ticket_assignments_assignee_user_id_unassigned_at_idx`(`assignee_user_id`, `unassigned_at`),
    INDEX `ticket_assignments_assigned_by_user_id_idx`(`assigned_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_status_history` (
    `id` CHAR(36) NOT NULL,
    `ticket_id` CHAR(36) NOT NULL,
    `from_status` ENUM('OPEN', 'PENDING', 'CUSTOMER_REPLY', 'ESCALATED', 'RESOLVED', 'CLOSED') NULL,
    `to_status` ENUM('OPEN', 'PENDING', 'CUSTOMER_REPLY', 'ESCALATED', 'RESOLVED', 'CLOSED') NOT NULL,
    `actor_user_id` CHAR(36) NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_status_history_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
    INDEX `ticket_status_history_actor_user_id_idx`(`actor_user_id`),
    INDEX `ticket_status_history_to_status_idx`(`to_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_requester_user_id_fkey` FOREIGN KEY (`requester_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `ticket_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_assignee_user_id_fkey` FOREIGN KEY (`assignee_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_status_history` ADD CONSTRAINT `ticket_status_history_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_status_history` ADD CONSTRAINT `ticket_status_history_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
