-- AlterTable
ALTER TABLE `run_record`
    ADD COLUMN `preview_distance_meters` DOUBLE NULL,
    ADD COLUMN `pace_seconds_per_km` INTEGER NULL;

UPDATE `run_record`
SET `pace_seconds_per_km` = CASE
    WHEN `distance_meters` > 0 THEN ROUND(`duration_seconds` / (`distance_meters` / 1000))
    ELSE NULL
END
WHERE `status` = 'COMPLETED';
