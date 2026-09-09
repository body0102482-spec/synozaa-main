-- CreateTable
CREATE TABLE "CaseUniversityOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "stationConfig" TEXT NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaseUniversityOverride_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseUniversityOverride_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "PartnerUniversity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStage" TEXT NOT NULL DEFAULT 'history',
    "activeManeuver" TEXT,
    "completedManeuvers" TEXT NOT NULL DEFAULT '[]',
    "resolvedStationConfig" TEXT NOT NULL DEFAULT '{}',
    "language" TEXT NOT NULL DEFAULT 'AUTO',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "aiPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "aiCompletionTokens" INTEGER NOT NULL DEFAULT 0,
    "aiTotalTokens" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("id", "userId", "caseId", "status", "currentStage", "activeManeuver", "completedManeuvers", "resolvedStationConfig", "language", "startedAt", "completedAt", "durationSeconds", "aiPromptTokens", "aiCompletionTokens", "aiTotalTokens") SELECT "id", "userId", "caseId", "status", "currentStage", "activeManeuver", "completedManeuvers", '{}', "language", "startedAt", "completedAt", "durationSeconds", "aiPromptTokens", "aiCompletionTokens", "aiTotalTokens" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CaseUniversityOverride_caseId_universityId_key" ON "CaseUniversityOverride"("caseId", "universityId");

-- CreateIndex
CREATE INDEX "CaseUniversityOverride_universityId_idx" ON "CaseUniversityOverride"("universityId");
