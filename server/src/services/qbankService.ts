import { prisma } from '../lib/prisma.js';
import { splitQuestionContent } from '../lib/qbankQuestionContent.js';
import { qbankModuleUniversityFilter, resolveUserUniversityId } from '../lib/universityScope.js';

export type QbankModuleView = {
  id: string;
  nameEn: string;
  nameAr: string;
  specialtyEn: string;
  specialtyAr: string;
  subjects: string[];
  locked: boolean;
  owned: boolean;
  priceEgp?: number;
};

export type QbankTermView = {
  id: string;
  titleEn: string;
  titleAr: string;
  modules: number;
  questions: number;
};

export type QbankQuestionView = {
  id: string;
  text: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
  chapter: string;
  source: string;
  chapterId: string;
  referenceId: string;
  subjectTags?: string[];
};

const MAX_EXAM_QUESTIONS = 100;

function parseSubjects(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toModuleView(
  mod: {
    id: string;
    nameEn: string;
    nameAr: string;
    specialtyEn: string;
    specialtyAr: string;
    subjects: string;
    free: boolean;
    bundled: boolean;
    priceEgp: number;
  },
  purchased: boolean,
): QbankModuleView {
  const owned = purchased || mod.bundled;
  const unlocked = mod.free || owned;
  return {
    id: mod.id,
    nameEn: mod.nameEn,
    nameAr: mod.nameAr,
    specialtyEn: mod.specialtyEn,
    specialtyAr: mod.specialtyAr,
    subjects: parseSubjects(mod.subjects),
    locked: !unlocked,
    owned,
    priceEgp: unlocked ? undefined : mod.priceEgp,
  };
}

export async function grantModuleAccess(userId: string, termId: string, moduleId: string) {
  return prisma.qbankModuleEntitlement.upsert({
    where: {
      userId_termId_moduleId: { userId, termId, moduleId },
    },
    create: { userId, termId, moduleId },
    update: {},
  });
}

export async function getUserEntitlements(userId: string, termId: string): Promise<Set<string>> {
  const rows = await prisma.qbankModuleEntitlement.findMany({
    where: { userId, termId },
    select: { moduleId: true },
  });
  return new Set(rows.map((r) => r.moduleId));
}

export async function getModuleFromDb(
  termId: string,
  moduleId: string,
  universityId?: string | null,
) {
  const visibility =
    universityId !== undefined ? qbankModuleUniversityFilter(universityId) : {};
  return prisma.qbankModule.findFirst({
    where: { id: moduleId, termId, isActive: true, ...visibility },
  });
}

export async function userHasModuleAccess(userId: string, termId: string, moduleId: string): Promise<boolean> {
  const universityId = await resolveUserUniversityId(userId);
  const mod = await getModuleFromDb(termId, moduleId, universityId);
  if (!mod) return false;
  if (mod.free) return true;
  const entitlements = await getUserEntitlements(userId, termId);
  return entitlements.has(moduleId) || mod.bundled;
}

export async function isPurchasableModule(userId: string, termId: string, moduleId: string): Promise<boolean> {
  const universityId = await resolveUserUniversityId(userId);
  const mod = await getModuleFromDb(termId, moduleId, universityId);
  return !!mod && !mod.free;
}

export async function getActiveTerms(userId: string): Promise<QbankTermView[]> {
  const universityId = await resolveUserUniversityId(userId);
  const moduleWhere = { isActive: true, ...qbankModuleUniversityFilter(universityId) };

  const terms = await prisma.qbankTerm.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      modules: {
        where: moduleWhere,
        include: { _count: { select: { questions: { where: { isPublished: true } } } } },
      },
    },
  });

  return terms
    .filter((term) => term.modules.length > 0)
    .map((term) => ({
      id: term.id,
      titleEn: term.titleEn,
      titleAr: term.titleAr,
      modules: term.modules.length,
      questions: term.modules.reduce((sum, m) => sum + m._count.questions, 0),
    }));
}

export async function getModulesForUser(userId: string, termId: string) {
  const universityId = await resolveUserUniversityId(userId);
  const moduleWhere = { isActive: true, ...qbankModuleUniversityFilter(universityId) };

  const term = await prisma.qbankTerm.findFirst({
    where: { id: termId, isActive: true },
    include: {
      modules: {
        where: moduleWhere,
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { questions: { where: { isPublished: true } } } } },
      },
    },
  });

  if (!term) {
    return { term: null, modules: [] as QbankModuleView[] };
  }

  const entitlements = await getUserEntitlements(userId, termId);
  const modules = term.modules.map((mod) => toModuleView(mod, entitlements.has(mod.id)));
  const questionCount = term.modules.reduce((sum, m) => sum + m._count.questions, 0);

  return {
    term: {
      id: term.id,
      titleEn: term.titleEn,
      titleAr: term.titleAr,
      modules: term.modules.length,
      questions: questionCount,
    },
    modules,
  };
}

export async function getModuleSetupMeta(termId: string, moduleId: string) {
  const mod = await prisma.qbankModule.findFirst({
    where: { id: moduleId, termId, isActive: true },
  });
  if (!mod) return null;

  const pairCounts = await prisma.qbankQuestion.groupBy({
    by: ['chapterId', 'referenceId'],
    where: { moduleId, isPublished: true },
    _count: { id: true },
  });

  const chapterIds = [...new Set(pairCounts.map((r) => r.chapterId))];
  const referenceIds = [...new Set(pairCounts.map((r) => r.referenceId))];

  const [chapters, references] = await Promise.all([
    chapterIds.length
      ? prisma.qbankChapter.findMany({
          where: { id: { in: chapterIds }, isActive: true },
          orderBy: { sortOrder: 'asc' },
        })
      : Promise.resolve([]),
    referenceIds.length
      ? prisma.qbankReference.findMany({
          where: { id: { in: referenceIds }, isActive: true },
          orderBy: { sortOrder: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const countMap = new Map<string, number>();
  for (const row of pairCounts) {
    countMap.set(`${row.chapterId}|${row.referenceId}`, row._count.id);
  }

  return {
    module: {
      id: mod.id,
      nameEn: mod.nameEn,
      nameAr: mod.nameAr,
      subjects: parseSubjects(mod.subjects),
    },
    chapters: chapters.map((c) => ({ id: c.id, nameEn: c.nameEn, nameAr: c.nameAr })),
    references: references.map((r) => ({ id: r.id, nameEn: r.nameEn, nameAr: r.nameAr })),
    pairCounts: chapters.flatMap((chapter) =>
      references.map((reference) => ({
        chapterId: chapter.id,
        chapter: chapter.nameEn,
        referenceId: reference.id,
        reference: reference.nameEn,
        count: countMap.get(`${chapter.id}|${reference.id}`) ?? 0,
      })),
    ),
  };
}

export async function countAvailableQuestions(
  moduleId: string,
  chapterIds: string[],
  referenceIds: string[],
  subjectTags?: string[],
): Promise<number> {
  if (chapterIds.length === 0 || referenceIds.length === 0) return 0;

  const questions = await prisma.qbankQuestion.findMany({
    where: {
      moduleId,
      isPublished: true,
      chapterId: { in: chapterIds },
      referenceId: { in: referenceIds },
    },
    select: { id: true, subjectTags: true },
  });

  if (!subjectTags?.length) return questions.length;

  return questions.filter((q) => {
    if (!q.subjectTags) return true;
    try {
      const tags = JSON.parse(q.subjectTags) as string[];
      return subjectTags.some((s) => tags.includes(s));
    } catch {
      return true;
    }
  }).length;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function fetchExamQuestions(
  moduleId: string,
  filters: {
    chapterIds: string[];
    referenceIds: string[];
    subjectTags?: string[];
    count: number;
    includeAnswers: boolean;
  },
): Promise<QbankQuestionView[]> {
  const limit = Math.min(Math.max(1, filters.count), MAX_EXAM_QUESTIONS);
  if (filters.chapterIds.length === 0 || filters.referenceIds.length === 0) return [];

  const rows = await prisma.qbankQuestion.findMany({
    where: {
      moduleId,
      isPublished: true,
      chapterId: { in: filters.chapterIds },
      referenceId: { in: filters.referenceIds },
    },
    include: { chapter: true, reference: true },
    orderBy: { sortOrder: 'asc' },
  });

  let filtered = rows;
  if (filters.subjectTags?.length) {
    filtered = rows.filter((q) => {
      if (!q.subjectTags) return true;
      try {
        const tags = JSON.parse(q.subjectTags) as string[];
        return filters.subjectTags!.some((s) => tags.includes(s));
      } catch {
        return true;
      }
    });
  }

  const selected = shuffle(filtered).slice(0, limit);

  return selected.map((q) => {
    const split = splitQuestionContent(q.text, q.explanation);
    let subjectTags: string[] | undefined;
    if (q.subjectTags) {
      try {
        const parsed = JSON.parse(q.subjectTags) as unknown;
        if (Array.isArray(parsed)) subjectTags = parsed.map(String);
      } catch {
        subjectTags = undefined;
      }
    }
    return {
      id: q.id,
      text: split.stem,
      options: parseOptions(q.options),
      ...(filters.includeAnswers
        ? {
            correctIndex: q.correctIndex,
            explanation: split.explanation,
          }
        : {}),
      chapter: q.chapter.nameEn,
      source: q.reference.nameEn,
      chapterId: q.chapterId,
      referenceId: q.referenceId,
      ...(subjectTags?.length ? { subjectTags } : {}),
    };
  });
}

export function validateQuestionInput(input: {
  text: string;
  options: string[];
  correctIndex: number;
}) {
  const errors: string[] = [];
  if (!input.text?.trim()) errors.push('Question text is required');
  if (!Array.isArray(input.options) || input.options.length !== 4) {
    errors.push('Exactly 4 options are required');
  } else if (input.options.some((o) => !String(o).trim())) {
    errors.push('All options must be non-empty');
  }
  if (!Number.isInteger(input.correctIndex) || input.correctIndex < 0 || input.correctIndex > 3) {
    errors.push('correctIndex must be 0–3');
  }
  return errors;
}

export { parseSubjects, parseOptions, MAX_EXAM_QUESTIONS };
