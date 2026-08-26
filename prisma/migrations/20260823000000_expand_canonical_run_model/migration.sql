-- AlterTable
ALTER TABLE `run_record`
    ADD COLUMN `status` ENUM('ACTIVE', 'PENDING_COMPLETION', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `duration_seconds` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `distance_meters` DOUBLE NOT NULL DEFAULT 0;

UPDATE `run_record`
SET
    `status` = CASE WHEN `endTime` IS NULL THEN 'ACTIVE' ELSE 'COMPLETED' END,
    `duration_seconds` = `duration`,
    `distance_meters` = `distance` * 1000;
