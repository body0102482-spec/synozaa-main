-- CreateTable
CREATE TABLE "QbankTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QbankModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "termId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "specialtyEn" TEXT NOT NULL,
    "specialtyAr" TEXT NOT NULL,
    "subjects" TEXT NOT NULL DEFAULT '[]',
    "free" BOOLEAN NOT NULL DEFAULT false,
    "bundled" BOOLEAN NOT NULL DEFAULT false,
    "priceEgp" INTEGER NOT NULL DEFAULT 50,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QbankModule_termId_fkey" FOREIGN KEY ("termId") REFERENCES "QbankTerm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QbankChapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QbankReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QbankQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "subjectTags" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QbankQuestion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "QbankModule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QbankQuestion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "QbankChapter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QbankQuestion_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "QbankReference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QbankModule_termId_isActive_idx" ON "QbankModule"("termId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "QbankChapter_nameEn_key" ON "QbankChapter"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "QbankReference_nameEn_key" ON "QbankReference"("nameEn");

-- CreateIndex
CREATE INDEX "QbankQuestion_moduleId_isPublished_idx" ON "QbankQuestion"("moduleId", "isPublished");

-- CreateIndex
CREATE INDEX "QbankQuestion_chapterId_referenceId_idx" ON "QbankQuestion"("chapterId", "referenceId");
