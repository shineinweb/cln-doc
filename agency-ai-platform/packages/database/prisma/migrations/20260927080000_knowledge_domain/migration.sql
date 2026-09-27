-- Knowledge domain:
-- KnowledgeCategory → KnowledgeArticle → KnowledgeRevision
-- KnowledgeDocument → KnowledgeChunk (RAG; embedding Json in MariaDB only)

-- CreateTable
CREATE TABLE `knowledge_categories` (
    `id` CHAR(36) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `key` VARCHAR(80) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` VARCHAR(500) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `knowledge_categories_key_key`(`key`),
    INDEX `knowledge_categories_parent_id_sort_order_idx`(`parent_id`, `sort_order`),
    INDEX `knowledge_categories_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_articles` (
    `id` CHAR(36) NOT NULL,
    `category_id` CHAR(36) NULL,
    `author_user_id` CHAR(36) NULL,
    `slug` VARCHAR(160) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `summary` VARCHAR(500) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `visibility` ENUM('PUBLIC', 'INTERNAL', 'BOTH') NOT NULL DEFAULT 'INTERNAL',
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `knowledge_articles_slug_key`(`slug`),
    INDEX `knowledge_articles_category_id_status_idx`(`category_id`, `status`),
    INDEX `knowledge_articles_status_visibility_published_at_idx`(`status`, `visibility`, `published_at`),
    INDEX `knowledge_articles_author_user_id_idx`(`author_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_revisions` (
    `id` CHAR(36) NOT NULL,
    `article_id` CHAR(36) NOT NULL,
    `author_user_id` CHAR(36) NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `change_note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_revisions_article_id_created_at_idx`(`article_id`, `created_at`),
    INDEX `knowledge_revisions_author_user_id_idx`(`author_user_id`),
    UNIQUE INDEX `knowledge_revisions_article_id_version_key`(`article_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_documents` (
    `id` CHAR(36) NOT NULL,
    `organization_id` CHAR(36) NULL,
    `uploaded_by_user_id` CHAR(36) NULL,
    `title` VARCHAR(300) NOT NULL,
    `source_type` ENUM('UPLOAD', 'URL', 'MANUAL') NOT NULL DEFAULT 'UPLOAD',
    `status` ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `storage_key` VARCHAR(500) NULL,
    `source_url` VARCHAR(1000) NULL,
    `mime_type` VARCHAR(120) NULL,
    `size_bytes` INTEGER NULL,
    `error_message` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `knowledge_documents_organization_id_status_idx`(`organization_id`, `status`),
    INDEX `knowledge_documents_status_created_at_idx`(`status`, `created_at`),
    INDEX `knowledge_documents_uploaded_by_user_id_idx`(`uploaded_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_chunks` (
    `id` CHAR(36) NOT NULL,
    `article_id` CHAR(36) NULL,
    `document_id` CHAR(36) NULL,
    `organization_id` CHAR(36) NULL,
    `chunk_index` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `token_count` INTEGER NULL,
    `embedding_json` JSON NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `knowledge_chunks_article_id_chunk_index_idx`(`article_id`, `chunk_index`),
    INDEX `knowledge_chunks_document_id_chunk_index_idx`(`document_id`, `chunk_index`),
    INDEX `knowledge_chunks_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `knowledge_categories` ADD CONSTRAINT `knowledge_categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `knowledge_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `knowledge_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_articles` ADD CONSTRAINT `knowledge_articles_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_revisions` ADD CONSTRAINT `knowledge_revisions_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_revisions` ADD CONSTRAINT `knowledge_revisions_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `knowledge_articles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
