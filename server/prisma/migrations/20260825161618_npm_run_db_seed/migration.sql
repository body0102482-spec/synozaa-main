-- AlterTable
ALTER TABLE "QbankQuestion" ADD COLUMN "explanation" TEXT;

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "sessionId" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" REAL NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    CONSTRAINT "AiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plan" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "priceEgp" REAL NOT NULL,
    "casesQuota" INTEGER NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiCostRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "model" TEXT NOT NULL,
    "inputPer1MUsd" REAL NOT NULL,
    "outputPer1MUsd" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AISettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "patientModel" TEXT NOT NULL DEFAULT 'gpt-realtime-mini',
    "examinerModel" TEXT NOT NULL DEFAULT 'gpt-realtime-mini',
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "systemPromptAr" TEXT,
    "systemPromptEn" TEXT,
    "patientSystemPromptAr" TEXT,
    "patientSystemPromptEn" TEXT,
    "examinerSystemPromptAr" TEXT,
    "examinerSystemPromptEn" TEXT,
    "maxContextMessages" INTEGER NOT NULL DEFAULT 12,
    "openRouterApiKey" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AISettings" ("examinerModel", "id", "maxTokens", "openRouterApiKey", "patientModel", "provider", "systemPromptAr", "systemPromptEn", "temperature", "updatedAt") SELECT "examinerModel", "id", "maxTokens", "openRouterApiKey", "patientModel", "provider", "systemPromptAr", "systemPromptEn", "temperature", "updatedAt" FROM "AISettings";
DROP TABLE "AISettings";
ALTER TABLE "new_AISettings" RENAME TO "AISettings";
CREATE TABLE "new_Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "difficultyId" TEXT NOT NULL,
    "categoryId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER NOT NULL,
    "patientGender" TEXT NOT NULL,
    "patientNationality" TEXT NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "medicalHistory" TEXT NOT NULL,
    "medicationHistory" TEXT NOT NULL,
    "surgicalHistory" TEXT NOT NULL,
    "familyHistory" TEXT NOT NULL,
    "socialHistory" TEXT NOT NULL,
    "physicalExam" TEXT NOT NULL,
    "labResults" TEXT NOT NULL,
    "examImages" TEXT NOT NULL DEFAULT '[]',
    "finalDiagnosis" TEXT NOT NULL,
    "teachingPoints" TEXT NOT NULL,
    "evaluationRubric" TEXT NOT NULL,
    "vitalSigns" TEXT NOT NULL,
    "examinerQuestions" TEXT NOT NULL DEFAULT '[]',
    "stationConfig" TEXT NOT NULL DEFAULT '{}',
    "patientPersonality" TEXT,
    "scenarioPrompt" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "isFreeTier" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_difficultyId_fkey" FOREIGN KEY ("difficultyId") REFERENCES "DifficultyLevel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Case_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" ("categoryId", "chiefComplaint", "createdAt", "difficultyId", "evaluationRubric", "examImages", "familyHistory", "finalDiagnosis", "id", "isFreeTier", "isPublished", "labResults", "medicalHistory", "medicationHistory", "patientAge", "patientGender", "patientName", "patientNationality", "patientPersonality", "physicalExam", "scenarioPrompt", "socialHistory", "specialtyId", "surgicalHistory", "teachingPoints", "titleAr", "titleEn", "updatedAt", "vitalSigns") SELECT "categoryId", "chiefComplaint", "createdAt", "difficultyId", "evaluationRubric", "examImages", "familyHistory", "finalDiagnosis", "id", "isFreeTier", "isPublished", "labResults", "medicalHistory", "medicationHistory", "patientAge", "patientGender", "patientName", "patientNationality", "patientPersonality", "physicalExam", "scenarioPrompt", "socialHistory", "specialtyId", "surgicalHistory", "teachingPoints", "titleAr", "titleEn", "updatedAt", "vitalSigns" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "university" TEXT,
    "universityId" TEXT,
    "studentId" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "preferredLang" TEXT NOT NULL DEFAULT 'en',
    "totalXp" REAL NOT NULL DEFAULT 0,
    "academicYear" TEXT,
    "lastSeenAt" DATETIME,
    "otpCode" TEXT,
    "otpExpires" DATETIME,
    "resetToken" TEXT,
    "resetExpires" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "PartnerUniversity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "email", "emailVerified", "firstName", "id", "isActive", "lastName", "otpCode", "otpExpires", "passwordHash", "phone", "preferredLang", "resetExpires", "resetToken", "role", "studentId", "totalXp", "university", "universityId", "updatedAt") SELECT "avatarUrl", "createdAt", "email", "emailVerified", "firstName", "id", "isActive", "lastName", "otpCode", "otpExpires", "passwordHash", "phone", "preferredLang", "resetExpires", "resetToken", "role", "studentId", "totalXp", "university", "universityId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");
CREATE INDEX "User_universityId_idx" ON "User"("universityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_feature_createdAt_idx" ON "AiUsageLog"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageLog_userId_createdAt_idx" ON "AiUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanConfig_plan_key" ON "PlanConfig"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "AiCostRate_model_key" ON "AiCostRate"("model");
