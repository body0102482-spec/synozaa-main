/**
 * Restore local SQLite from deploy/staging/db-export.json (production snapshot).
 * Run: npx tsx scripts/restore-from-export.ts
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportPath = path.resolve(__dirname, '../../deploy/staging/db-export.json');
const prisma = new PrismaClient();

function stripMeta(row: Record<string, unknown>) {
  const copy = { ...row };
  for (const key of [
    'specialty',
    'difficulty',
    'category',
    'sessions',
    'caseAccess',
    'module',
    'chapter',
    'term',
    'questions',
    'chapters',
    'references',
    'entitlements',
  ]) {
    delete copy[key];
  }
  return copy;
}

async function main() {
  const raw = readFileSync(exportPath, 'utf8');
  const data = JSON.parse(raw) as {
    specialties: Record<string, unknown>[];
    difficultyLevels: Record<string, unknown>[];
    cases: Record<string, unknown>[];
    qbankModules: Record<string, unknown>[];
    qbankChapters: Record<string, unknown>[];
    qbankTerms: Record<string, unknown>[];
    qbankReferences: Record<string, unknown>[];
    qbankQuestions: Record<string, unknown>[];
  };

  console.log('Clearing local content that will be replaced…');
  await prisma.message.deleteMany({});
  await prisma.result.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.caseAccess.deleteMany({});
  await prisma.case.deleteMany({});
  await prisma.qbankQuestion.deleteMany({});
  await prisma.qbankModuleEntitlement.deleteMany({}).catch(() => undefined);
  await prisma.qbankModule.deleteMany({});
  await prisma.qbankChapter.deleteMany({});
  await prisma.qbankReference.deleteMany({});
  await prisma.qbankTerm.deleteMany({});
  await prisma.difficultyLevel.deleteMany({});
  await prisma.specialty.deleteMany({});

  console.log('Importing specialties…');
  for (const row of data.specialties ?? []) {
    const item = stripMeta(row);
    await prisma.specialty.create({ data: item as never });
  }

  console.log('Importing difficulty levels…');
  for (const row of data.difficultyLevels ?? []) {
    const item = stripMeta(row);
    await prisma.difficultyLevel.create({ data: item as never });
  }

  console.log('Importing cases…');
  let caseOk = 0;
  for (const row of data.cases ?? []) {
    const item = stripMeta(row);
    item.categoryId = null;
    await prisma.case.create({ data: item as never });
    caseOk += 1;
  }

  console.log('Importing qbank terms…');
  for (const row of data.qbankTerms ?? []) {
    await prisma.qbankTerm.create({ data: stripMeta(row) as never });
  }

  console.log('Importing qbank modules…');
  for (const row of data.qbankModules ?? []) {
    await prisma.qbankModule.create({ data: stripMeta(row) as never });
  }

  console.log('Importing qbank chapters…');
  for (const row of data.qbankChapters ?? []) {
    await prisma.qbankChapter.create({ data: stripMeta(row) as never });
  }

  console.log('Importing qbank references…');
  for (const row of data.qbankReferences ?? []) {
    await prisma.qbankReference.create({ data: stripMeta(row) as never });
  }

  const neededRefIds = [
    ...new Set(
      (data.qbankQuestions ?? [])
        .map((q) => String(q.referenceId ?? ''))
        .filter(Boolean),
    ),
  ];
  for (const id of neededRefIds) {
    const exists = await prisma.qbankReference.findUnique({ where: { id } });
    if (!exists) {
      await prisma.qbankReference.create({
        data: {
          id,
          nameEn: `Imported reference ${id.slice(-6)}`,
          nameAr: null,
          sortOrder: 0,
          isActive: true,
        },
      });
    }
  }

  console.log('Importing qbank questions…');
  let qOk = 0;
  for (const row of data.qbankQuestions ?? []) {
    await prisma.qbankQuestion.create({ data: stripMeta(row) as never });
    qOk += 1;
  }

  console.log('Done:', {
    cases: await prisma.case.count(),
    specialties: await prisma.specialty.count(),
    qbankQuestions: await prisma.qbankQuestion.count(),
    importedCases: caseOk,
    importedQuestions: qOk,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
