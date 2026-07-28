-- AlterTable
ALTER TABLE `playground` ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `location_addr` VARCHAR(191) NULL,
    ADD COLUMN `location_lat` DOUBLE NULL,
    ADD COLUMN `location_lng` DOUBLE NULL;

-- CreateTable
CREATE TABLE `invite_code` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `playGroundId` VARCHAR(191) NOT NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `max_uses` INTEGER NOT NULL DEFAULT 0,
    `use_count` INTEGER NOT NULL DEFAULT 0,
    `expires_at` TIMESTAMP(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL,

    UNIQUE INDEX `invite_code_code_key`(`code`),
    INDEX `idx_invite_code_code`(`code`),
    INDEX `idx_invite_code_playground_id`(`playGroundId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invite_code` ADD CONSTRAINT `invite_code_playground_id_fkey` FOREIGN KEY (`playGroundId`) REFERENCES `playground`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
