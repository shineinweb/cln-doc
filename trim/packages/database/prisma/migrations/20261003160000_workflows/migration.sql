-- AlterTable
ALTER TABLE `crop_cycles` ADD COLUMN `workflow_version_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `teams` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `teams_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `teams_organization_id_name_key`(`organization_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_members` (
    `team_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `team_members_user_id_idx`(`user_id`),
    PRIMARY KEY (`team_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sop_records` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sop_records_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `sop_records_organization_id_title_key`(`organization_id`, `title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_templates` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workflow_templates_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `workflow_templates_organization_id_name_key`(`organization_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_template_versions` (
    `id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NOT NULL,
    `version_number` INTEGER NOT NULL,
    `duration_days` INTEGER NOT NULL,
    `starting_event` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workflow_template_versions_template_id_idx`(`template_id`),
    UNIQUE INDEX `workflow_template_versions_template_id_version_number_key`(`template_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_task_templates` (
    `id` VARCHAR(191) NOT NULL,
    `version_id` VARCHAR(191) NOT NULL,
    `task_key` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `offset_days` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `assignee_type` VARCHAR(191) NOT NULL,
    `team_id` VARCHAR(191) NULL,
    `role_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `instructions` TEXT NOT NULL,
    `sop_record_id` VARCHAR(191) NULL,
    `requires_notes` BOOLEAN NOT NULL DEFAULT false,
    `requires_measurement` BOOLEAN NOT NULL DEFAULT false,
    `requires_photo` BOOLEAN NOT NULL DEFAULT false,
    `requires_sign_off` BOOLEAN NOT NULL DEFAULT false,
    `depends_on_key` VARCHAR(191) NULL,
    `requires_approval` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workflow_task_templates_version_id_idx`(`version_id`),
    UNIQUE INDEX `workflow_task_templates_version_id_task_key_key`(`version_id`, `task_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_checklist_items` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(500) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workflow_checklist_items_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cycle_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `cycle_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `source_template_id` VARCHAR(191) NULL,
    `task_key` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `instructions` TEXT NOT NULL,
    `offset_days` INTEGER NOT NULL,
    `due_on` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `assignee_type` VARCHAR(191) NOT NULL,
    `team_id` VARCHAR(191) NULL,
    `role_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `assignee_label` VARCHAR(191) NOT NULL,
    `sop_record_id` VARCHAR(191) NULL,
    `requires_notes` BOOLEAN NOT NULL DEFAULT false,
    `requires_measurement` BOOLEAN NOT NULL DEFAULT false,
    `requires_photo` BOOLEAN NOT NULL DEFAULT false,
    `requires_sign_off` BOOLEAN NOT NULL DEFAULT false,
    `requires_approval` BOOLEAN NOT NULL DEFAULT false,
    `depends_on_task_id` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `measurement_value` DECIMAL(10, 2) NULL,
    `measurement_unit` VARCHAR(191) NULL,
    `signed_off_at` DATETIME(3) NULL,
    `signed_off_by_name` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cycle_tasks_room_id_due_on_idx`(`room_id`, `due_on`),
    INDEX `cycle_tasks_cycle_id_idx`(`cycle_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cycle_task_checklist_items` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(500) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `checked` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cycle_task_checklist_items_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cycle_task_comments` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `author_name` VARCHAR(191) NOT NULL,
    `body` VARCHAR(2000) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cycle_task_comments_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cycle_task_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `task_id` VARCHAR(191) NOT NULL,
    `object_key` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `content_type` VARCHAR(191) NOT NULL,
    `byte_size` INTEGER NOT NULL,
    `uploaded_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cycle_task_attachments_object_key_key`(`object_key`),
    INDEX `cycle_task_attachments_task_id_idx`(`task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `crop_cycles` ADD CONSTRAINT `crop_cycles_workflow_version_id_fkey` FOREIGN KEY (`workflow_version_id`) REFERENCES `workflow_template_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `teams_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sop_records` ADD CONSTRAINT `sop_records_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_templates` ADD CONSTRAINT `workflow_templates_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_template_versions` ADD CONSTRAINT `workflow_template_versions_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `workflow_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_task_templates` ADD CONSTRAINT `workflow_task_templates_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `workflow_template_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_task_templates` ADD CONSTRAINT `workflow_task_templates_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_task_templates` ADD CONSTRAINT `workflow_task_templates_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_task_templates` ADD CONSTRAINT `workflow_task_templates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_task_templates` ADD CONSTRAINT `workflow_task_templates_sop_record_id_fkey` FOREIGN KEY (`sop_record_id`) REFERENCES `sop_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_checklist_items` ADD CONSTRAINT `workflow_checklist_items_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `workflow_task_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_tasks` ADD CONSTRAINT `cycle_tasks_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `crop_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_tasks` ADD CONSTRAINT `cycle_tasks_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_tasks` ADD CONSTRAINT `cycle_tasks_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_tasks` ADD CONSTRAINT `cycle_tasks_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_tasks` ADD CONSTRAINT `cycle_tasks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_tasks` ADD CONSTRAINT `cycle_tasks_sop_record_id_fkey` FOREIGN KEY (`sop_record_id`) REFERENCES `sop_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_tasks` ADD CONSTRAINT `cycle_tasks_depends_on_task_id_fkey` FOREIGN KEY (`depends_on_task_id`) REFERENCES `cycle_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_task_checklist_items` ADD CONSTRAINT `cycle_task_checklist_items_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `cycle_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_task_comments` ADD CONSTRAINT `cycle_task_comments_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `cycle_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_task_comments` ADD CONSTRAINT `cycle_task_comments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_task_attachments` ADD CONSTRAINT `cycle_task_attachments_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `cycle_tasks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cycle_task_attachments` ADD CONSTRAINT `cycle_task_attachments_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

