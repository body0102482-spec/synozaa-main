export type QbankModule = {
  id: string;
  nameEn: string;
  nameAr: string;
  specialtyEn: string;
  specialtyAr: string;
  subjects: string[];
  locked: boolean;
  owned?: boolean;
  priceEgp?: number;
};

export type QbankTerm = {
  id: string;
  titleEn: string;
  titleAr: string;
  modules: number;
  questions: number;
};

export type QbankQuestion = {
  id: string | number;
  text: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
  chapter: string;
  source: string;
  chapterId?: string;
  referenceId?: string;
  subjectTags?: string[];
};

export type QbankExamConfig = {
  mode: 'practice' | 'exam';
  questionCount: number;
  subjects: string[];
  chapters: string[];
  references: string[];
  chapterIds?: string[];
  referenceIds?: string[];
  examDurationMinutes?: number;
};

export type QbankAnswerState = {
  selected: number | null;
  marked: boolean;
  skipped: boolean;
  revealed?: boolean;
};

export type QbankExamResult = {
  config: QbankExamConfig;
  answers: QbankAnswerState[];
  questions: QbankQuestion[];
  startedAt: number;
  finishedAt: number;
  termId: string;
  moduleId: string;
};

export const QBANK_QUESTION_COUNTS = [10, 20, 30, 50, 'all'] as const;

export function resolveQuestionCount(requested: number | 'all', available: number): number {
  if (available <= 0) return 0;
  if (requested === 'all') return available;
  return Math.min(Math.max(1, requested), available);
}

export function scoreExamResult(result: QbankExamResult) {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  for (let i = 0; i < result.questions.length; i += 1) {
    const a = result.answers[i];
    const correctIndex = result.questions[i].correctIndex;
    if (correctIndex == null) continue;
    if (a?.selected == null && !a?.skipped) {
      unanswered += 1;
    } else if (a?.selected === correctIndex) {
      correct += 1;
    } else if (a?.selected != null) {
      incorrect += 1;
    }
  }
  const total = result.questions.length;
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, incorrect, unanswered, total, scorePct };
}

export function examStorageKey(termId: string, moduleId: string) {
  return `synoza-qbank-exam-${termId}-${moduleId}`;
}

export function examQuestionsStorageKey(termId: string, moduleId: string) {
  return `synoza-qbank-exam-questions-${termId}-${moduleId}`;
}
