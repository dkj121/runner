-- CreateTable
CREATE TABLE `account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `accessToken` VARCHAR(191) NULL,
    `refreshToken` VARCHAR(191) NULL,
    `accessTokenExpiresAt` TIMESTAMP(3) NULL,
    `refreshTokenExpiresAt` TIMESTAMP(3) NULL,
    `scope` VARCHAR(191) NULL,
    `idToken` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playground` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `visibility` ENUM('PRIVATE', 'PUBLIC') NOT NULL DEFAULT 'PUBLIC',
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `idx_playground_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playground_rankinglist` (
    `id` VARCHAR(191) NOT NULL,
    `playGroundId` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `idx_playground_rankinglist_playground_id`(`playGroundId`),
    UNIQUE INDEX `playground_rankinglist_playGroundId_key`(`playGroundId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `total_run_record` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `totalTime` INTEGER NOT NULL DEFAULT 0,
    `totalDistance` DOUBLE NOT NULL DEFAULT 0,
    `avgPace` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `idx_total_run_record_user_id`(`userId`),
    UNIQUE INDEX `total_run_record_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `run_record` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `playGroundRankingListId` VARCHAR(191) NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `duration` INTEGER NOT NULL DEFAULT 0,
    `distance` DOUBLE NOT NULL DEFAULT 0,
    `avgPace` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `idx_run_record_user_id`(`userId`),
    INDEX `idx_run_record_playground_rankinglist_id`(`playGroundRankingListId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_schedule` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleType` ENUM('DAILY', 'WEEKLY', 'MONTHLY') NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `idx_user_schedule_user_id`(`userId`),
    UNIQUE INDEX `user_schedule_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playground_schedule` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleType` ENUM('DAILY', 'WEEKLY', 'MONTHLY') NULL,
    `playGroundId` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `idx_playground_schedule_playground_id`(`playGroundId`),
    UNIQUE INDEX `playground_schedule_playGroundId_key`(`playGroundId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_schedule_spot` (
    `id` VARCHAR(191) NOT NULL,
    `weekDay` ENUM('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY') NOT NULL,
    `date` DATE NOT NULL,
    `time` TIME NOT NULL,
    `userScheduleId` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `idx_user_schedule_spot_userschedule_id`(`userScheduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playground_schedule_spot` (
    `id` VARCHAR(191) NOT NULL,
    `weekDay` ENUM('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY') NOT NULL,
    `date` DATE NOT NULL,
    `time` TIME NOT NULL,
    `playGroundScheduleId` VARCHAR(191) NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `idx_playground_schedule_spot_playground_schedule_id`(`playGroundScheduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` TIMESTAMP(3) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    UNIQUE INDEX `session_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `image` VARCHAR(191) NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    INDEX `idx_user_name`(`name`),
    INDEX `idx_user_email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `playground_user` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `playGroundId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'USER') NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    INDEX `idx_playground_user_userid`(`userId`),
    INDEX `idx_playground_user_playgroundid`(`playGroundId`),
    UNIQUE INDEX `playground_user_userId_playGroundId_key`(`userId`, `playGroundId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `expiresAt` TIMESTAMP(3) NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL,
    `updatedAt` TIMESTAMP(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playground_rankinglist` ADD CONSTRAINT `playground_rankinglist_playgroundid_fkey` FOREIGN KEY (`playGroundId`) REFERENCES `playground`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `total_run_record` ADD CONSTRAINT `total_run_record_user_id_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `run_record` ADD CONSTRAINT `run_record_user_id_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `run_record` ADD CONSTRAINT `run_record_playground_rankinglist_id_fkey` FOREIGN KEY (`playGroundRankingListId`) REFERENCES `playground_rankinglist`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_schedule` ADD CONSTRAINT `user_schedule_userid_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playground_schedule` ADD CONSTRAINT `playground_schedule_playgroundid_fkey` FOREIGN KEY (`playGroundId`) REFERENCES `playground`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_schedule_spot` ADD CONSTRAINT `user_schedule_spot_userscheduleid_fkey` FOREIGN KEY (`userScheduleId`) REFERENCES `user_schedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playground_schedule_spot` ADD CONSTRAINT `playground_schedule_spot_playgroundscheduleid_fkey` FOREIGN KEY (`playGroundScheduleId`) REFERENCES `playground_schedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playground_user` ADD CONSTRAINT `playground_user_userid_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `playground_user` ADD CONSTRAINT `playground_user_playgroundid_fkey` FOREIGN KEY (`playGroundId`) REFERENCES `playground`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
