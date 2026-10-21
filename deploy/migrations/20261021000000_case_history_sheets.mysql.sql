CREATE TABLE `HistorySheet` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HistorySheet_caseId_key` (`caseId`),
    UNIQUE INDEX `HistorySheet_storageKey_key` (`storageKey`),
    PRIMARY KEY (`id`),
    CONSTRAINT `HistorySheet_caseId_fkey`
      FOREIGN KEY (`caseId`) REFERENCES `Case` (`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
