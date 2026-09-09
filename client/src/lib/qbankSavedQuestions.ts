import type { QbankQuestion } from '../data/qbankMock';

const STORAGE_KEY = 'synoza-qbank-saved-v1';
const SAVED_CHANGED_EVENT = 'synoza:qbank-saved-changed';

export type QbankSavedRecord = {
  key: string;
  termId: string;
  moduleId: string;
  question: QbankQuestion;
  savedAt: number;
};

export type QbankSavedModuleGroup = {
  termId: string;
  termTitle: string;
  moduleId: string;
  moduleTitle: string;
  specialty: string;
  questions: QbankSavedRecord[];
};

export function buildSavedQuestionKey(termId: string, moduleId: string, questionId: string | number) {
  return `${termId}:${moduleId}:${questionId}`;
}

function readStore(): QbankSavedRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QbankSavedRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(records: QbankSavedRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(SAVED_CHANGED_EVENT));
}

export function loadAllSavedQuestions(): QbankSavedRecord[] {
  return readStore().sort((a, b) => b.savedAt - a.savedAt);
}

export function isQuestionSaved(key: string): boolean {
  return readStore().some((record) => record.key === key);
}

export function toggleSavedQuestion(
  termId: string,
  moduleId: string,
  question: QbankQuestion,
): boolean {
  const key = buildSavedQuestionKey(termId, moduleId, question.id);
  const store = readStore();
  const exists = store.some((record) => record.key === key);
  if (exists) {
    writeStore(store.filter((record) => record.key !== key));
    return false;
  }
  writeStore([
    {
      key,
      termId,
      moduleId,
      question,
      savedAt: Date.now(),
    },
    ...store,
  ]);
  return true;
}

export function removeSavedQuestion(key: string) {
  writeStore(readStore().filter((record) => record.key !== key));
}

export function groupSavedByModule(records: QbankSavedRecord[], isAr: boolean): QbankSavedModuleGroup[] {
  const groups = new Map<string, QbankSavedModuleGroup>();

  for (const record of records) {
    const groupKey = `${record.termId}:${record.moduleId}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.questions.push(record);
      continue;
    }

    groups.set(groupKey, {
      termId: record.termId,
      termTitle: record.termId,
      moduleId: record.moduleId,
      moduleTitle: record.moduleId,
      specialty: '',
      questions: [record],
    });
  }

  void isAr;
  return Array.from(groups.values()).map((group) => ({
    ...group,
    questions: [...group.questions].sort((a, b) => b.savedAt - a.savedAt),
  }));
}

export function subscribeSavedQuestions(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener(SAVED_CHANGED_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(SAVED_CHANGED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
