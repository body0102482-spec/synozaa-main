-- Allow deleting a Case even when Sessions still reference it (messages/results cascade off Session).
-- SQLite requires table rebuild for FK changes; MySQL can ALTER in place when using that schema.

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
    CONSTRAINT "Session_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" (
  "id", "userId", "caseId", "status", "currentStage", "activeManeuver", "completedManeuvers",
  "resolvedStationConfig", "language", "startedAt", "completedAt", "durationSeconds",
  "aiPromptTokens", "aiCompletionTokens", "aiTotalTokens"
)
SELECT
  "id", "userId", "caseId", "status", "currentStage", "activeManeuver", "completedManeuvers",
  "resolvedStationConfig", "language", "startedAt", "completedAt", "durationSeconds",
  "aiPromptTokens", "aiCompletionTokens", "aiTotalTokens"
FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
