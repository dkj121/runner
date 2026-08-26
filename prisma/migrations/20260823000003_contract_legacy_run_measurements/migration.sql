-- Populate canonical run measurements from the legacy columns one final time.
UPDATE `run_record`
SET
    `status` = CASE WHEN `endTime` IS NULL THEN `status` ELSE 'COMPLETED' END,
    `duration_seconds` = `duration`,
    `distance_meters` = `distance` * 1000,
    `pace_seconds_per_km` = CASE
        WHEN `distance` > 0 THEN ROUND(`duration` / `distance`)
        ELSE NULL
    END;

-- Expand canonical lifetime totals before dropping their formatted legacy values.
ALTER TABLE `total_run_record`
    ADD COLUMN `total_duration_seconds` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `total_distance_meters` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `average_pace_seconds_per_km` INTEGER NULL;

UPDATE `total_run_record`
SET
    `total_duration_seconds` = `totalTime`,
    `total_distance_meters` = `totalDistance` * 1000,
    `average_pace_seconds_per_km` = CASE
        WHEN `totalDistance` > 0 THEN ROUND(`totalTime` / `totalDistance`)
        ELSE NULL
    END;

ALTER TABLE `run_record`
    DROP COLUMN `duration`,
    DROP COLUMN `distance`,
    DROP COLUMN `avgPace`;

ALTER TABLE `total_run_record`
    DROP COLUMN `totalTime`,
    DROP COLUMN `totalDistance`,
    DROP COLUMN `avgPace`;
