-- CreateEnum
-- SQLite stores enums as TEXT; Prisma client enums: AiKnowledgeRole, AiKnowledgeKind

-- CreateTable
CREATE TABLE "AiKnowledgeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "fileUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "categoryId" TEXT,
    "caseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiKnowledgeEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "KnowledgeCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiKnowledgeEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_role_isActive_idx" ON "AiKnowledgeEntry"("role", "isActive");

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_categoryId_role_idx" ON "AiKnowledgeEntry"("categoryId", "role");

-- CreateIndex
CREATE INDEX "AiKnowledgeEntry_caseId_role_idx" ON "AiKnowledgeEntry"("caseId", "role");
