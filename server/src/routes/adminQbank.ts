import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { Role } from '@prisma/client';
import {
  parseOptions,
  parseSubjects,
  validateQuestionInput,
  grantModuleAccess,
} from '../services/qbankService.js';
import { syncModuleUniversities } from '../lib/universityScope.js';
import {
  parseStructuredQbankImport,
  sanitizeImportedReferenceName,
  type StructuredQbankQuestion,
} from '../lib/qbankStructuredImportParser.js';

const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN));

const CSV_COLUMNS = [
  'termId',
  'moduleId',
  'chapter',
  'reference',
  'text',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'correctIndex',
  'subjectTags',
  'isPublished',
] as const;

type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>;

const IMPORT_TEMPLATE_EXAMPLES = [
  {
    text: 'Which of the following is the most common cause of upper gastrointestinal bleeding?',
    options: ['Gastric carcinoma', 'Duodenal ulcer', 'Esophageal varices', 'Mallory-Weiss tear'],
    correctIndex: 1,
    subjectTags: 'GIT|Hepatology',
  },
  {
    text: 'A patient with chronic hepatitis B is at highest risk of developing which complication?',
    options: ['Pancreatitis', 'Hepatocellular carcinoma', 'Cholecystitis', 'Peptic ulcer disease'],
    correctIndex: 1,
    subjectTags: 'GIT',
  },
] as const;

function escapeCsvCell(value: string): string {
  const v = String(value ?? '');
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function buildCsvContent(rows: string[][]): string {
  return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

async function buildImportTemplateCsv(): Promise<string> {
  const defaults = {
    termId: '401',
    moduleId: 'med-1',
    chapterNames: ['Esophagus', 'Stomach'],
    referenceNames: ['Lang', 'Bailey & Love'],
  };

  let termId = defaults.termId;
  let moduleId = defaults.moduleId;
  let chapterNames = defaults.chapterNames;
  let referenceNames = defaults.referenceNames;

  try {
    const [term, chapters, references] = await Promise.all([
      prisma.qbankTerm.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.qbankChapter.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 2 }),
      prisma.qbankReference.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, take: 2 }),
    ]);

    const mod = term
      ? await prisma.qbankModule.findFirst({
          where: { termId: term.id, isActive: true },
          orderBy: { sortOrder: 'asc' },
        })
      : null;

    if (term?.id) termId = term.id;
    if (mod?.id) moduleId = mod.id;
    if (chapters.length) chapterNames = chapters.map((c) => c.nameEn);
    if (references.length) referenceNames = references.map((r) => r.nameEn);
  } catch (error) {
    console.warn('[qbank template] Using static defaults:', error);
  }

  const rows: string[][] = [Array.from(CSV_COLUMNS)];

  IMPORT_TEMPLATE_EXAMPLES.forEach((example, index) => {
    rows.push([
      termId,
      moduleId,
      chapterNames[index] ?? chapterNames[0],
      referenceNames[index] ?? referenceNames[0],
      example.text,
      example.options[0],
      example.options[1],
      example.options[2],
      example.options[3],
      String(example.correctIndex),
      example.subjectTags,
      'true',
    ]);
  });

  return buildCsvContent(rows);
}

function parseCsvContent(csvContent: string): CsvRow[] {
  return parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as CsvRow[];
}

async function resolveChapterId(name: string) {
  const chapter = await prisma.qbankChapter.findFirst({
    where: { nameEn: name.trim(), isActive: true },
  });
  return chapter?.id ?? null;
}

async function resolveReferenceId(name: string) {
  const reference = await prisma.qbankReference.findFirst({
    where: { nameEn: name.trim(), isActive: true },
  });
  return reference?.id ?? null;
}

async function ensureChapterId(
  name: string,
  cache?: Map<string, string>,
): Promise<string> {
  const trimmed = name.trim() || 'General';
  const hit = cache?.get(`ch:${trimmed.toLowerCase()}`);
  if (hit) return hit;
  const existing = await prisma.qbankChapter.findFirst({ where: { nameEn: trimmed } });
  if (existing) {
    cache?.set(`ch:${trimmed.toLowerCase()}`, existing.id);
    return existing.id;
  }
  const created = await prisma.qbankChapter.create({
    data: { nameEn: trimmed, isActive: true },
  });
  cache?.set(`ch:${trimmed.toLowerCase()}`, created.id);
  return created.id;
}

async function ensureReferenceId(
  name: string,
  cache?: Map<string, string>,
): Promise<string> {
  const trimmed = sanitizeImportedReferenceName(name);
  const hit = cache?.get(`ref:${trimmed.toLowerCase()}`);
  if (hit) return hit;
  const existing = await prisma.qbankReference.findFirst({ where: { nameEn: trimmed } });
  if (existing) {
    cache?.set(`ref:${trimmed.toLowerCase()}`, existing.id);
    return existing.id;
  }
  const created = await prisma.qbankReference.create({
    data: { nameEn: trimmed, isActive: true },
  });
  cache?.set(`ref:${trimmed.toLowerCase()}`, created.id);
  return created.id;
}

type StructuredImportRow = {
  rowNum: number;
  valid: boolean;
  errors: string[];
  data: {
    moduleId: string;
    chapterId: string;
    referenceId: string;
    text: string;
    options: string[];
    correctIndex: number;
    explanation: string | null;
    subjectTags: string[] | null;
    isPublished: boolean;
  } | null;
  preview?: {
    chapter: string;
    reference: string;
    text: string;
    correctIndex: number;
  };
};

async function validateStructuredQuestion(
  question: StructuredQbankQuestion,
  rowNum: number,
  termId: string,
  moduleId: string,
  autoCreateLookups: boolean,
  lookupCache?: Map<string, string>,
  subjectOverride?: string,
): Promise<StructuredImportRow> {
  const errors: string[] = [];

  const mod = await prisma.qbankModule.findFirst({
    where: { id: moduleId, termId, isActive: true },
  });
  if (!mod) errors.push(`Module ${moduleId} not found in term ${termId}`);

  errors.push(
    ...validateQuestionInput({
      text: question.text,
      options: question.options,
      correctIndex: question.correctIndex,
    }),
  );

  if (!question.chapter.trim()) errors.push('Chapter is required');

  let chapterId: string | null = null;
  let referenceId: string | null = null;

  if (question.chapter.trim()) {
    if (autoCreateLookups) {
      chapterId = await ensureChapterId(question.chapter, lookupCache);
    } else {
      chapterId = await resolveChapterId(question.chapter);
      if (!chapterId) errors.push(`Chapter "${question.chapter}" not found`);
    }
  }

  const referenceName = sanitizeImportedReferenceName(question.source);
  if (autoCreateLookups) {
    referenceId = await ensureReferenceId(referenceName, lookupCache);
  } else {
    referenceId = await resolveReferenceId(referenceName);
    if (!referenceId) errors.push(`Reference "${referenceName}" not found`);
  }

  const override = subjectOverride?.trim();
  const subjectTags = override
    ? [override]
    : question.tags.length
      ? question.tags
      : null;

  return {
    rowNum,
    valid: errors.length === 0 && !!mod && !!chapterId && !!referenceId,
    errors,
    data:
      errors.length === 0 && mod && chapterId && referenceId
        ? {
            moduleId: mod.id,
            chapterId,
            referenceId,
            text: question.text,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation?.trim() || null,
            subjectTags,
            isPublished: true,
          }
        : null,
    preview: {
      chapter: question.chapter,
      reference: referenceName,
      text: question.text.slice(0, 120) + (question.text.length > 120 ? '…' : ''),
      correctIndex: question.correctIndex,
    },
  };
}

async function validateImportRow(row: CsvRow, rowNum: number) {
  const errors: string[] = [];
  const termId = row.termId?.trim();
  const moduleId = row.moduleId?.trim();
  const chapterName = row.chapter?.trim();
  const referenceName = row.reference?.trim();

  if (!termId) errors.push('termId is required');
  if (!moduleId) errors.push('moduleId is required');
  if (!chapterName) errors.push('chapter is required');
  if (!referenceName) errors.push('reference is required');

  const mod =
    termId && moduleId
      ? await prisma.qbankModule.findFirst({ where: { id: moduleId, termId, isActive: true } })
      : null;
  if (termId && moduleId && !mod) errors.push(`Module ${moduleId} not found in term ${termId}`);

  const chapterId = chapterName ? await resolveChapterId(chapterName) : null;
  if (chapterName && !chapterId) errors.push(`Chapter "${chapterName}" not found`);

  const referenceId = referenceName ? await resolveReferenceId(referenceName) : null;
  if (referenceName && !referenceId) errors.push(`Reference "${referenceName}" not found`);

  const options = [row.optionA, row.optionB, row.optionC, row.optionD].map((o) => String(o ?? '').trim());
  const correctIndex = Number.parseInt(String(row.correctIndex ?? ''), 10);
  errors.push(...validateQuestionInput({ text: row.text ?? '', options, correctIndex }));

  let subjectTags: string[] | null = null;
  if (row.subjectTags?.trim()) {
    subjectTags = row.subjectTags.split(/[|;]/).map((s) => s.trim()).filter(Boolean);
  }

  const isPublished = String(row.isPublished ?? 'true').toLowerCase() !== 'false';

  return {
    rowNum,
    valid: errors.length === 0,
    errors,
    data:
      errors.length === 0 && mod && chapterId && referenceId
        ? {
            moduleId: mod.id,
            chapterId,
            referenceId,
            text: row.text.trim(),
            options,
            correctIndex,
            subjectTags,
            isPublished,
          }
        : null,
  };
}

// --- Terms ---
router.get('/terms', async (_req, res) => {
  const terms = await prisma.qbankTerm.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { modules: true } } },
  });
  res.json({ terms });
});

router.post('/terms', async (req, res) => {
  const { id, titleEn, titleAr, sortOrder = 0, isActive = true } = req.body;
  if (!id?.trim() || !titleEn?.trim() || !titleAr?.trim()) {
    return res.status(400).json({ error: 'id, titleEn, and titleAr are required' });
  }
  const term = await prisma.qbankTerm.create({
    data: {
      id: String(id).trim(),
      titleEn: String(titleEn).trim(),
      titleAr: String(titleAr).trim(),
      sortOrder: Number(sortOrder) || 0,
      isActive: !!isActive,
    },
  });
  res.status(201).json({ term });
});

router.put('/terms/:id', async (req, res) => {
  const { titleEn, titleAr, sortOrder, isActive } = req.body;
  const term = await prisma.qbankTerm.update({
    where: { id: req.params.id },
    data: {
      ...(titleEn != null ? { titleEn: String(titleEn).trim() } : {}),
      ...(titleAr != null ? { titleAr: String(titleAr).trim() } : {}),
      ...(sortOrder != null ? { sortOrder: Number(sortOrder) || 0 } : {}),
      ...(isActive != null ? { isActive: !!isActive } : {}),
    },
  });
  res.json({ term });
});

router.delete('/terms/:id', async (req, res) => {
  const moduleCount = await prisma.qbankModule.count({ where: { termId: req.params.id } });
  if (moduleCount > 0) {
    return res.status(400).json({ error: 'Cannot delete term with modules. Remove modules first.' });
  }
  await prisma.qbankTerm.delete({ where: { id: req.params.id } });
  res.json({ message: 'Term deleted' });
});

// --- Modules ---
router.get('/terms/:termId/modules', async (req, res) => {
  const modules = await prisma.qbankModule.findMany({
    where: { termId: req.params.termId },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { questions: true } },
      universities: { include: { university: { select: { id: true, nameEn: true, nameAr: true } } } },
    },
  });
  res.json({
    modules: modules.map((m) => ({
      ...m,
      subjects: parseSubjects(m.subjects),
      universityIds: m.universities.map((row) => row.universityId),
      universities: m.universities.map((row) => row.university),
    })),
  });
});

router.post('/terms/:termId/modules', async (req, res) => {
  const {
    id,
    nameEn,
    nameAr,
    specialtyEn,
    specialtyAr,
    subjects = [],
    free = false,
    bundled = false,
    priceEgp = 50,
    sortOrder = 0,
    isActive = true,
    universityIds = [],
  } = req.body;

  if (!id?.trim() || !nameEn?.trim() || !nameAr?.trim()) {
    return res.status(400).json({ error: 'id, nameEn, and nameAr are required' });
  }

  const mod = await prisma.qbankModule.create({
    data: {
      id: String(id).trim(),
      termId: req.params.termId,
      nameEn: String(nameEn).trim(),
      nameAr: String(nameAr).trim(),
      specialtyEn: String(specialtyEn ?? nameEn).trim(),
      specialtyAr: String(specialtyAr ?? nameAr).trim(),
      subjects: JSON.stringify(Array.isArray(subjects) ? subjects : []),
      free: !!free,
      bundled: !!bundled,
      priceEgp: Number(priceEgp) || 50,
      sortOrder: Number(sortOrder) || 0,
      isActive: !!isActive,
    },
  });

  try {
    await syncModuleUniversities(
      mod.id,
      Array.isArray(universityIds) ? universityIds.map(String) : [],
    );
  } catch (error) {
    await prisma.qbankModule.delete({ where: { id: mod.id } });
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid universities' });
  }

  const linked = await prisma.qbankModuleUniversity.findMany({
    where: { moduleId: mod.id },
    include: { university: { select: { id: true, nameEn: true, nameAr: true } } },
  });

  res.status(201).json({
    module: {
      ...mod,
      subjects: parseSubjects(mod.subjects),
      universityIds: linked.map((row) => row.universityId),
      universities: linked.map((row) => row.university),
    },
  });
});

router.put('/modules/:id', async (req, res) => {
  const existing = await prisma.qbankModule.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Module not found' });

  const {
    nameEn,
    nameAr,
    specialtyEn,
    specialtyAr,
    subjects,
    free,
    bundled,
    priceEgp,
    sortOrder,
    isActive,
    universityIds,
  } = req.body;

  const mod = await prisma.qbankModule.update({
    where: { id: req.params.id },
    data: {
      ...(nameEn != null ? { nameEn: String(nameEn).trim() } : {}),
      ...(nameAr != null ? { nameAr: String(nameAr).trim() } : {}),
      ...(specialtyEn != null ? { specialtyEn: String(specialtyEn).trim() } : {}),
      ...(specialtyAr != null ? { specialtyAr: String(specialtyAr).trim() } : {}),
      ...(subjects != null ? { subjects: JSON.stringify(Array.isArray(subjects) ? subjects : []) } : {}),
      ...(free != null ? { free: !!free } : {}),
      ...(bundled != null ? { bundled: !!bundled } : {}),
      ...(priceEgp != null ? { priceEgp: Number(priceEgp) || 50 } : {}),
      ...(sortOrder != null ? { sortOrder: Number(sortOrder) || 0 } : {}),
      ...(isActive != null ? { isActive: !!isActive } : {}),
    },
  });

  if (universityIds != null) {
    try {
      await syncModuleUniversities(
        mod.id,
        Array.isArray(universityIds) ? universityIds.map(String) : [],
      );
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid universities' });
    }
  }

  const linked = await prisma.qbankModuleUniversity.findMany({
    where: { moduleId: mod.id },
    include: { university: { select: { id: true, nameEn: true, nameAr: true } } },
  });

  res.json({
    module: {
      ...mod,
      subjects: parseSubjects(mod.subjects),
      universityIds: linked.map((row) => row.universityId),
      universities: linked.map((row) => row.university),
    },
  });
});

router.delete('/modules/:id', async (req, res) => {
  const qCount = await prisma.qbankQuestion.count({ where: { moduleId: req.params.id } });
  if (qCount > 0) {
    return res.status(400).json({ error: 'Cannot delete module with questions. Delete questions first.' });
  }
  await prisma.qbankModule.delete({ where: { id: req.params.id } });
  res.json({ message: 'Module deleted' });
});

// --- Chapters ---
router.get('/chapters', async (_req, res) => {
  const chapters = await prisma.qbankChapter.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { questions: true } } },
  });
  res.json({ chapters });
});

router.post('/chapters', async (req, res) => {
  const { nameEn, nameAr, sortOrder = 0, isActive = true } = req.body;
  if (!nameEn?.trim()) return res.status(400).json({ error: 'nameEn is required' });
  const chapter = await prisma.qbankChapter.create({
    data: {
      nameEn: String(nameEn).trim(),
      nameAr: nameAr ? String(nameAr).trim() : null,
      sortOrder: Number(sortOrder) || 0,
      isActive: !!isActive,
    },
  });
  res.status(201).json({ chapter });
});

router.put('/chapters/:id', async (req, res) => {
  const { nameEn, nameAr, sortOrder, isActive } = req.body;
  const chapter = await prisma.qbankChapter.update({
    where: { id: req.params.id },
    data: {
      ...(nameEn != null ? { nameEn: String(nameEn).trim() } : {}),
      ...(nameAr != null ? { nameAr: nameAr ? String(nameAr).trim() : null } : {}),
      ...(sortOrder != null ? { sortOrder: Number(sortOrder) || 0 } : {}),
      ...(isActive != null ? { isActive: !!isActive } : {}),
    },
  });
  res.json({ chapter });
});

router.delete('/chapters/:id', async (req, res) => {
  const qCount = await prisma.qbankQuestion.count({ where: { chapterId: req.params.id } });
  if (qCount > 0) {
    return res.status(400).json({ error: 'Cannot delete chapter linked to questions' });
  }
  await prisma.qbankChapter.delete({ where: { id: req.params.id } });
  res.json({ message: 'Chapter deleted' });
});

// --- References ---
router.get('/references', async (_req, res) => {
  const references = await prisma.qbankReference.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { questions: true } } },
  });
  res.json({ references });
});

router.post('/references', async (req, res) => {
  const { nameEn, nameAr, sortOrder = 0, isActive = true } = req.body;
  if (!nameEn?.trim()) return res.status(400).json({ error: 'nameEn is required' });
  const reference = await prisma.qbankReference.create({
    data: {
      nameEn: String(nameEn).trim(),
      nameAr: nameAr ? String(nameAr).trim() : null,
      sortOrder: Number(sortOrder) || 0,
      isActive: !!isActive,
    },
  });
  res.status(201).json({ reference });
});

router.put('/references/:id', async (req, res) => {
  const { nameEn, nameAr, sortOrder, isActive } = req.body;
  const reference = await prisma.qbankReference.update({
    where: { id: req.params.id },
    data: {
      ...(nameEn != null ? { nameEn: String(nameEn).trim() } : {}),
      ...(nameAr != null ? { nameAr: nameAr ? String(nameAr).trim() : null } : {}),
      ...(sortOrder != null ? { sortOrder: Number(sortOrder) || 0 } : {}),
      ...(isActive != null ? { isActive: !!isActive } : {}),
    },
  });
  res.json({ reference });
});

router.delete('/references/:id', async (req, res) => {
  const qCount = await prisma.qbankQuestion.count({ where: { referenceId: req.params.id } });
  if (qCount > 0) {
    return res.status(400).json({ error: 'Cannot delete reference linked to questions' });
  }
  await prisma.qbankReference.delete({ where: { id: req.params.id } });
  res.json({ message: 'Reference deleted' });
});

// --- Questions ---
router.get('/questions', async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Number.parseInt(String(req.query.pageSize ?? '20'), 10) || 20);
  const where: {
    moduleId?: string;
    chapterId?: string;
    referenceId?: string;
    module?: { termId: string };
    OR?: Array<{ text: { contains: string } }>;
  } = {};

  if (req.query.moduleId) where.moduleId = String(req.query.moduleId);
  if (req.query.chapterId) where.chapterId = String(req.query.chapterId);
  if (req.query.referenceId) where.referenceId = String(req.query.referenceId);
  if (req.query.termId) where.module = { termId: String(req.query.termId) };
  if (req.query.search) {
    where.OR = [{ text: { contains: String(req.query.search) } }];
  }

  const [total, questions] = await Promise.all([
    prisma.qbankQuestion.count({ where }),
    prisma.qbankQuestion.findMany({
      where,
      include: { chapter: true, reference: true, module: { select: { id: true, nameEn: true, termId: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    questions: questions.map((q) => ({
      ...q,
      options: parseOptions(q.options),
      subjectTags: q.subjectTags ? JSON.parse(q.subjectTags) : [],
    })),
    total,
    page,
    pageSize,
  });
});

router.post('/questions', async (req, res) => {
  const {
    moduleId,
    chapterId,
    referenceId,
    text,
    options,
    correctIndex,
    explanation,
    subjectTags,
    isPublished = true,
    sortOrder = 0,
  } = req.body;

  const errors = validateQuestionInput({ text, options, correctIndex: Number(correctIndex) });
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const mod = await prisma.qbankModule.findUnique({ where: { id: moduleId } });
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  const question = await prisma.qbankQuestion.create({
    data: {
      moduleId,
      chapterId,
      referenceId,
      text: String(text).trim(),
      options: JSON.stringify(options),
      correctIndex: Number(correctIndex),
      explanation: explanation != null ? String(explanation).trim() || null : null,
      subjectTags: subjectTags?.length ? JSON.stringify(subjectTags) : null,
      isPublished: !!isPublished,
      sortOrder: Number(sortOrder) || 0,
    },
    include: { chapter: true, reference: true },
  });

  res.status(201).json({
    question: {
      ...question,
      options: parseOptions(question.options),
      subjectTags: subjectTags ?? [],
    },
  });
});

router.put('/questions/:id', async (req, res) => {
  const existing = await prisma.qbankQuestion.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Question not found' });

  const { moduleId, chapterId, referenceId, text, options, correctIndex, explanation, subjectTags, isPublished, sortOrder } =
    req.body;

  const nextOptions = options ?? parseOptions(existing.options);
  const nextCorrect = correctIndex ?? existing.correctIndex;
  const errors = validateQuestionInput({
    text: text ?? existing.text,
    options: nextOptions,
    correctIndex: Number(nextCorrect),
  });
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const question = await prisma.qbankQuestion.update({
    where: { id: req.params.id },
    data: {
      ...(moduleId != null ? { moduleId } : {}),
      ...(chapterId != null ? { chapterId } : {}),
      ...(referenceId != null ? { referenceId } : {}),
      ...(text != null ? { text: String(text).trim() } : {}),
      ...(options != null ? { options: JSON.stringify(options) } : {}),
      ...(correctIndex != null ? { correctIndex: Number(correctIndex) } : {}),
      ...(explanation !== undefined
        ? { explanation: explanation != null ? String(explanation).trim() || null : null }
        : {}),
      ...(subjectTags != null
        ? { subjectTags: subjectTags.length ? JSON.stringify(subjectTags) : null }
        : {}),
      ...(isPublished != null ? { isPublished: !!isPublished } : {}),
      ...(sortOrder != null ? { sortOrder: Number(sortOrder) || 0 } : {}),
    },
    include: { chapter: true, reference: true },
  });

  res.json({
    question: {
      ...question,
      options: parseOptions(question.options),
      subjectTags: question.subjectTags ? JSON.parse(question.subjectTags) : [],
    },
  });
});

router.delete('/questions/:id', async (req, res) => {
  await prisma.qbankQuestion.delete({ where: { id: req.params.id } });
  res.json({ message: 'Question deleted' });
});

// --- Bulk import ---
router.get('/questions/import/template', async (_req, res) => {
  try {
    const csv = await buildImportTemplateCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="qbank-import-template.csv"');
    res.send(csv);
  } catch (error) {
    console.error('[qbank template]', error);
    res.status(500).json({ error: 'Could not build import template' });
  }
});

router.post('/questions/import/preview', async (req, res) => {
  const csvContent = String(req.body?.csvContent ?? '');
  if (!csvContent.trim()) return res.status(400).json({ error: 'csvContent is required' });

  let rows: CsvRow[];
  try {
    rows = parseCsvContent(csvContent);
  } catch {
    return res.status(400).json({ error: 'Invalid CSV format' });
  }

  const results = await Promise.all(rows.map((row, i) => validateImportRow(row, i + 2)));
  const valid = results.filter((r) => r.valid);
  const invalid = results.filter((r) => !r.valid);

  res.json({
    total: results.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    invalid,
    validPreview: valid.slice(0, 5).map((r) => r.data),
  });
});

router.post('/questions/import/commit', async (req, res) => {
  const csvContent = String(req.body?.csvContent ?? '');
  if (!csvContent.trim()) return res.status(400).json({ error: 'csvContent is required' });

  let rows: CsvRow[];
  try {
    rows = parseCsvContent(csvContent);
  } catch {
    return res.status(400).json({ error: 'Invalid CSV format' });
  }

  const results = await Promise.all(rows.map((row, i) => validateImportRow(row, i + 2)));
  const validRows = results.filter((r) => r.valid && r.data);

  let inserted = 0;
  for (const row of validRows) {
    if (!row.data) continue;
    await prisma.qbankQuestion.create({
      data: {
        moduleId: row.data.moduleId,
        chapterId: row.data.chapterId,
        referenceId: row.data.referenceId,
        text: row.data.text,
        options: JSON.stringify(row.data.options),
        correctIndex: row.data.correctIndex,
        subjectTags: row.data.subjectTags?.length ? JSON.stringify(row.data.subjectTags) : null,
        isPublished: row.data.isPublished,
      },
    });
    inserted += 1;
  }

  res.json({
    inserted,
    skipped: results.length - validRows.length,
    invalid: results.filter((r) => !r.valid),
  });
});

router.post('/questions/import/structured/preview', async (req, res) => {
  const content = String(req.body?.content ?? '').trim();
  const termId = String(req.body?.termId ?? '').trim();
  const moduleId = String(req.body?.moduleId ?? '').trim();
  const subject = String(req.body?.subject ?? '').trim();
  const autoCreateLookups = req.body?.autoCreateLookups !== false;

  if (!content) return res.status(400).json({ error: 'content is required' });
  if (!termId || !moduleId) return res.status(400).json({ error: 'termId and moduleId are required' });

  const { questions, errors: parseErrors } = parseStructuredQbankImport(content);
  if (!questions.length && parseErrors.length) {
    return res.status(400).json({ error: parseErrors.join(' ') });
  }

  const lookupCache = new Map<string, string>();
  const results: StructuredImportRow[] = [];
  for (let i = 0; i < questions.length; i += 1) {
    results.push(
      await validateStructuredQuestion(
        questions[i],
        i + 1,
        termId,
        moduleId,
        autoCreateLookups,
        lookupCache,
        subject || undefined,
      ),
    );
  }
  const valid = results.filter((r) => r.valid);
  const invalid = results.filter((r) => !r.valid);

  res.json({
    total: results.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    parseErrors,
    invalid,
    validPreview: valid.map((r) => r.preview),
  });
});

router.post('/questions/import/structured/commit', async (req, res) => {
  const content = String(req.body?.content ?? '').trim();
  const termId = String(req.body?.termId ?? '').trim();
  const moduleId = String(req.body?.moduleId ?? '').trim();
  const subject = String(req.body?.subject ?? '').trim();
  const autoCreateLookups = req.body?.autoCreateLookups !== false;

  if (!content) return res.status(400).json({ error: 'content is required' });
  if (!termId || !moduleId) return res.status(400).json({ error: 'termId and moduleId are required' });

  const { questions, errors: parseErrors } = parseStructuredQbankImport(content);
  if (!questions.length) {
    return res.status(400).json({ error: parseErrors.join(' ') || 'No questions parsed' });
  }

  const lookupCache = new Map<string, string>();
  const results: StructuredImportRow[] = [];
  for (let i = 0; i < questions.length; i += 1) {
    results.push(
      await validateStructuredQuestion(
        questions[i],
        i + 1,
        termId,
        moduleId,
        autoCreateLookups,
        lookupCache,
        subject || undefined,
      ),
    );
  }
  const validRows = results.filter((r) => r.valid && r.data);

  let inserted = 0;
  const insertedPreview: Array<{ text: string; chapter: string; reference: string }> = [];
  for (const row of validRows) {
    if (!row.data) continue;
    await prisma.qbankQuestion.create({
      data: {
        moduleId: row.data.moduleId,
        chapterId: row.data.chapterId,
        referenceId: row.data.referenceId,
        text: row.data.text,
        options: JSON.stringify(row.data.options),
        correctIndex: row.data.correctIndex,
        explanation: row.data.explanation,
        subjectTags: row.data.subjectTags?.length ? JSON.stringify(row.data.subjectTags) : null,
        isPublished: row.data.isPublished,
      },
    });
    inserted += 1;
    if (row.preview) {
      insertedPreview.push({
        text: row.preview.text,
        chapter: row.preview.chapter,
        reference: row.preview.reference,
      });
    }
  }

  res.json({
    inserted,
    skipped: results.length - validRows.length,
    parseErrors,
    invalid: results.filter((r) => !r.valid),
    insertedPreview,
    moduleId,
    termId,
  });
});

// --- Entitlements (optional admin utility) ---
router.get('/entitlements', async (req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const entitlements = await prisma.qbankModuleEntitlement.findMany({
    where: userId ? { userId } : undefined,
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ entitlements });
});

router.post('/entitlements', async (req, res) => {
  const { userId, termId, moduleId } = req.body;
  if (!userId || !termId || !moduleId) {
    return res.status(400).json({ error: 'userId, termId, and moduleId are required' });
  }
  const entitlement = await grantModuleAccess(String(userId), String(termId), String(moduleId));
  res.status(201).json({ entitlement });
});

router.delete('/entitlements/:id', async (req, res) => {
  await prisma.qbankModuleEntitlement.delete({ where: { id: req.params.id } });
  res.json({ message: 'Entitlement revoked' });
});

export default router;
