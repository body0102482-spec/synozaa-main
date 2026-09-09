-- AlterTable
ALTER TABLE "User" ADD COLUMN "universityId" TEXT;

-- CreateTable
CREATE TABLE "QbankModuleUniversity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    CONSTRAINT "QbankModuleUniversity_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "QbankModule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QbankModuleUniversity_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "PartnerUniversity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "QbankModuleUniversity_moduleId_universityId_key" ON "QbankModuleUniversity"("moduleId", "universityId");

-- CreateIndex
CREATE INDEX "QbankModuleUniversity_universityId_idx" ON "QbankModuleUniversity"("universityId");

-- CreateIndex
CREATE INDEX "User_universityId_idx" ON "User"("universityId");
