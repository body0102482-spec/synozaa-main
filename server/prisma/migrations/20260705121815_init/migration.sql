-- CreateTable
CREATE TABLE "KnowledgeCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'QUESTION',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "university" TEXT,
    "studentId" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "preferredLang" TEXT NOT NULL DEFAULT 'en',
    "totalXp" REAL NOT NULL DEFAULT 0,
    "otpCode" TEXT,
    "otpExpires" DATETIME,
    "resetToken" TEXT,
    "resetExpires" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DifficultyLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Case" (
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

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStage" TEXT NOT NULL DEFAULT 'history',
    "activeManeuver" TEXT,
    "completedManeuvers" TEXT NOT NULL DEFAULT '[]',
    "language" TEXT NOT NULL DEFAULT 'AUTO',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'history',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "totalScore" REAL NOT NULL,
    "communicationScore" REAL NOT NULL,
    "historyTakingScore" REAL NOT NULL,
    "clinicalReasonScore" REAL NOT NULL,
    "organizationScore" REAL NOT NULL,
    "closingScore" REAL NOT NULL,
    "strengths" TEXT NOT NULL,
    "weaknesses" TEXT NOT NULL,
    "missedQuestions" TEXT NOT NULL,
    "clinicalErrors" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "idealApproach" TEXT NOT NULL,
    "fullReport" TEXT NOT NULL,
    "xpBreakdown" TEXT NOT NULL DEFAULT '[]',
    "xpCalculated" REAL NOT NULL DEFAULT 0,
    "xpAwarded" REAL NOT NULL DEFAULT 0,
    "xpIsRepeat" BOOLEAN NOT NULL DEFAULT false,
    "xpApplied" BOOLEAN NOT NULL DEFAULT false,
    "xpRankSnapshot" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Result_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "casesQuota" INTEGER NOT NULL DEFAULT 0,
    "priceEgp" INTEGER,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaseAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseAccess_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productType" TEXT NOT NULL DEFAULT 'SUBSCRIPTION_PLAN',
    "plan" TEXT,
    "qbankTermId" TEXT,
    "qbankModuleId" TEXT,
    "amountEgp" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'paymob',
    "merchantOrderId" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "transactionId" TEXT,
    "paidAt" DATETIME,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QbankModuleEntitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QbankModuleEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AISettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "patientModel" TEXT NOT NULL DEFAULT 'gpt-realtime-mini',
    "examinerModel" TEXT NOT NULL DEFAULT 'gpt-realtime-mini',
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1024,
    "systemPromptAr" TEXT,
    "systemPromptEn" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "valueEn" TEXT NOT NULL,
    "valueAr" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PartnerUniversity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "footerTaglineEn" TEXT NOT NULL DEFAULT 'AI-Powered OSCE Medical Training Platform',
    "footerTaglineAr" TEXT NOT NULL DEFAULT 'منصة التدريب الطبي بالذكاء الاصطناعي - OSCE',
    "contactPhone" TEXT NOT NULL DEFAULT '01024828652',
    "contactEmail" TEXT,
    "ctaTitleEn" TEXT NOT NULL DEFAULT 'Ready to practice?',
    "ctaTitleAr" TEXT NOT NULL DEFAULT 'جاهز للتدريب؟',
    "ctaSubtitleEn" TEXT NOT NULL DEFAULT 'Join Synoza and start your OSCE training today.',
    "ctaSubtitleAr" TEXT NOT NULL DEFAULT 'انضم إلى Synoza وابدأ تدريب OSCE اليوم.',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DifficultyLevel_level_key" ON "DifficultyLevel"("level");

-- CreateIndex
CREATE UNIQUE INDEX "Result_sessionId_key" ON "Result"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseAccess_userId_caseId_key" ON "CaseAccess"("userId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_merchantOrderId_key" ON "PaymentOrder"("merchantOrderId");

-- CreateIndex
CREATE INDEX "PaymentOrder_userId_status_idx" ON "PaymentOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "QbankModuleEntitlement_userId_termId_idx" ON "QbankModuleEntitlement"("userId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "QbankModuleEntitlement_userId_termId_moduleId_key" ON "QbankModuleEntitlement"("userId", "termId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteContent_key_key" ON "SiteContent"("key");
