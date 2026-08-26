-- AlterTable
ALTER TABLE `run_record` ADD COLUMN `calories` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `notes` VARCHAR(191) NULL,
    ADD COLUMN `splits` JSON NULL,
    ADD COLUMN `track_points` JSON NULL;
