-- AlterTable
ALTER TABLE `run_record`
    ADD COLUMN `active_session_owner_id` VARCHAR(191) NULL;

-- Backfill active-session ownership. The unique index intentionally rejects
-- databases that already contain multiple unresolved sessions for one Runner,
-- so those records must be reviewed instead of silently rewritten.
UPDATE `run_record`
SET `active_session_owner_id` = `userId`
WHERE `status` IN ('ACTIVE', 'PENDING_COMPLETION');

-- CreateIndex
CREATE UNIQUE INDEX `unique_active_run_session_owner`
ON `run_record`(`active_session_owner_id`);
