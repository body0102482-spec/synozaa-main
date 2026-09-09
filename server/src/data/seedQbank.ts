import type { PrismaClient } from '@prisma/client';
import { QBANK_TERMS, QBANK_MODULES_401 } from './qbankCatalogSeed.js';

const QBANK_CHAPTERS = [
  'Esophagus',
  'Stomach',
  'Small Intestine',
  'Colon',
  'Hepatitis',
  'Cirrhosis',
  'Portal Hypertension',
];

const QBANK_REFERENCES = [
  'Lang',
  'Bailey & Love',
  'Ain Shams',
  'Kasr Al Ainy',
  'El Zatona',
  'Previous Years',
  'Cairo University',
  'Alex University',
];

const SAMPLE_QUESTIONS = [
  {
    text: 'Which of the following is the most common cause of upper gastrointestinal bleeding?',
    options: ['Gastric carcinoma', 'Duodenal ulcer', 'Esophageal varices', 'Mallory-Weiss tear'],
    correctIndex: 1,
  },
  {
    text: 'A patient with chronic hepatitis B is at highest risk of developing which complication?',
    options: ['Pancreatitis', 'Hepatocellular carcinoma', 'Cholecystitis', 'Peptic ulcer disease'],
    correctIndex: 1,
  },
  {
    text: 'The most sensitive test for diagnosing H. pylori infection before treatment is:',
    options: ['Serology', 'Urea breath test', 'Stool antigen after PPI', 'Barium meal'],
    correctIndex: 1,
  },
  {
    text: 'Portal hypertension is most commonly caused by:',
    options: ['Budd-Chiari syndrome', 'Cirrhosis', 'Portal vein thrombosis', 'Right heart failure'],
    correctIndex: 1,
  },
  {
    text: 'Which finding is most specific for ascites due to cirrhosis?',
    options: ['Shifting dullness', 'Fluid thrill', 'SAAG > 1.1 g/dL', 'Hepatojugular reflux'],
    correctIndex: 2,
  },
];

export async function seedQbankCatalog(prisma: PrismaClient) {
  console.log('  Seeding Q-Bank catalog...');

  for (let i = 0; i < QBANK_TERMS.length; i += 1) {
    const term = QBANK_TERMS[i];
    await prisma.qbankTerm.upsert({
      where: { id: term.id },
      create: {
        id: term.id,
        titleEn: term.titleEn,
        titleAr: term.titleAr,
        sortOrder: i,
        isActive: true,
      },
      update: {
        titleEn: term.titleEn,
        titleAr: term.titleAr,
        sortOrder: i,
      },
    });
  }

  for (let i = 0; i < QBANK_CHAPTERS.length; i += 1) {
    const name = QBANK_CHAPTERS[i];
    await prisma.qbankChapter.upsert({
      where: { nameEn: name },
      create: { nameEn: name, sortOrder: i, isActive: true },
      update: { sortOrder: i },
    });
  }

  for (let i = 0; i < QBANK_REFERENCES.length; i += 1) {
    const name = QBANK_REFERENCES[i];
    await prisma.qbankReference.upsert({
      where: { nameEn: name },
      create: { nameEn: name, sortOrder: i, isActive: true },
      update: { sortOrder: i },
    });
  }

  const chapters = await prisma.qbankChapter.findMany({ orderBy: { sortOrder: 'asc' } });
  const references = await prisma.qbankReference.findMany({ orderBy: { sortOrder: 'asc' } });

  for (let i = 0; i < QBANK_MODULES_401.length; i += 1) {
    const mod = QBANK_MODULES_401[i];
    await prisma.qbankModule.upsert({
      where: { id: mod.id },
      create: {
        id: mod.id,
        termId: '401',
        nameEn: mod.nameEn,
        nameAr: mod.nameAr,
        specialtyEn: mod.specialtyEn,
        specialtyAr: mod.specialtyAr,
        subjects: JSON.stringify(mod.subjects),
        free: !!mod.free,
        bundled: !!mod.bundled,
        priceEgp: mod.priceEgp,
        sortOrder: i,
        isActive: true,
      },
      update: {
        nameEn: mod.nameEn,
        nameAr: mod.nameAr,
        specialtyEn: mod.specialtyEn,
        specialtyAr: mod.specialtyAr,
        subjects: JSON.stringify(mod.subjects),
        free: !!mod.free,
        bundled: !!mod.bundled,
        priceEgp: mod.priceEgp,
        sortOrder: i,
      },
    });
  }

  const med1 = await prisma.qbankModule.findUnique({ where: { id: 'med-1' } });
  if (!med1) return;

  const existingCount = await prisma.qbankQuestion.count({ where: { moduleId: 'med-1' } });
  if (existingCount > 0) {
    console.log(`  Q-Bank questions already seeded (${existingCount} for med-1)`);
    return;
  }

  let sortOrder = 0;
  for (const chapter of chapters) {
    for (const reference of references) {
      for (let q = 0; q < 3; q += 1) {
        const sample = SAMPLE_QUESTIONS[(sortOrder + q) % SAMPLE_QUESTIONS.length];
        await prisma.qbankQuestion.create({
          data: {
            moduleId: 'med-1',
            chapterId: chapter.id,
            referenceId: reference.id,
            text: sample.text,
            options: JSON.stringify(sample.options),
            correctIndex: sample.correctIndex,
            subjectTags: JSON.stringify(['GIT', 'Hepatology']),
            isPublished: true,
            sortOrder,
          },
        });
        sortOrder += 1;
      }
    }
  }

  console.log(`  + Q-Bank: ${QBANK_TERMS.length} terms, ${QBANK_MODULES_401.length} modules (401), ${sortOrder} questions (med-1)`);
}
