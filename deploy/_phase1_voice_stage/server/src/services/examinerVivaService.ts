import type { Case } from "@prisma/client";
import { evaluateHistoryVivaAnswer } from "./aiService.js";

export const HISTORY_EXAMINER_STAGE = "history:examiner";
export const VIVA_QUESTIONS_PER_SESSION = 5;

export interface ExaminerVivaItem {
  question: string;
  sampleAnswer: string;
}

const VIVA_CLOSING_EN =
  "Thank you. That completes the examiner viva for this station. You may continue with the rest of the OSCE. Good luck!";
const VIVA_CLOSING_AR =
  "شكراً. كده خلصنا أسئلة الـ examiner في المحطة دي. تقدر تكمل باقي الـ OSCE. بالتوفيق!";

/** @deprecated Prefer getVivaClosing(lang) */
export const VIVA_CLOSING = VIVA_CLOSING_EN;

export function getVivaClosing(language?: string): string {
  const code = String(language || 'EN').toUpperCase();
  if (code === 'EN') return VIVA_CLOSING_EN;
  // AR and AUTO → Arabic closing with بالتوفيق
  return VIVA_CLOSING_AR;
}

export function isVivaClosingText(content: string): boolean {
  const text = content || '';
  return (
    text.includes('completes the examiner viva') ||
    text.includes('خلصنا أسئلة') ||
    text.includes('بالتوفيق') ||
    text.includes('Good luck')
  );
}

const QUESTION_POOLS: Record<string, string[]> = {
  heartFailure: [
    "What are the key clinical features that suggest acute decompensated heart failure in this patient?",
    "How would you differentiate cardiac dyspnea from primary respiratory causes at the bedside?",
    "Which physical signs would you look for to assess volume overload?",
    "What is the role of BNP or NT-proBNP in evaluating breathlessness?",
    "Which medications improve long-term mortality in heart failure with reduced ejection fraction?",
    "How would you assess volume status before starting diuretics?",
    "What findings on chest examination would support pulmonary congestion?",
    "What red flags would make you admit this patient urgently?",
    "How does orthopnea help you in your differential diagnosis?",
    "What lifestyle and self-care advice is important in chronic heart failure?",
    "Which investigations would you order first in suspected ADHF?",
    "How would ankle swelling guide your history and examination?",
  ],
  valvular: [
    "What features in the history suggest underlying valvular heart disease?",
    "How does severe aortic stenosis typically present clinically?",
    "What murmur characteristics help you distinguish aortic stenosis from mitral regurgitation?",
    "Why is rheumatic fever history important in a young patient with dyspnea?",
    "What is the purpose of penicillin prophylaxis after rheumatic fever?",
    "What symptoms suggest low cardiac output in valvular disease?",
    "How would you investigate a new systolic murmur in a young adult?",
    "What does a narrow pulse pressure suggest on examination?",
    "When would you refer a patient with valvular disease for surgery?",
    "What are the risks of exertion in severe aortic stenosis?",
    "How would paroxysmal nocturnal dyspnea change your assessment?",
    "What does a displaced heaving apex suggest?",
  ],
  default: [
    "What is your leading differential diagnosis based on the history so far?",
    "Which features in the history are most concerning and why?",
    "What key points would you cover in a systems review for this presentation?",
    "How would you prioritize your investigations for this case?",
    "What red flags would change your management urgently?",
    "How would you explain your initial management plan to the patient?",
    "What further history would help narrow the differential?",
    "Which physical examination findings would you expect in this case?",
    "How would you document your clinical reasoning for the examiner?",
    "What safety-net advice would you give before discharge?",
    "Which comorbidities would most affect your treatment choices?",
    "What is the most important question you still need to ask this patient?",
  ],
};

const GAVE_UP_PATTERNS = [
  /\bdon'?t\s+know\b/i,
  /\bi\s+don'?t\s+know\b/i,
  /\bi\s+do\s+not\s+know\b/i,
  /\bdunno\b/i,
  /\bidk\b/i,
  /\bnot\s+sure\b/i,
  /\bno\s+idea\b/i,
  /\bno\s+clue\b/i,
  /\bcan'?t\s+remember\b/i,
  /\bunsure\b/i,
  /مش\s+عارف/i,
  /معرفش/i,
  /لا\s+أعرف/i,
  /مش\s+فاكر/i,
  /مش\s+عارفه/i,
  /مش\s+عارفة/i,
  /مش\s+عرف/i,
];

function casePoolKey(caseData: Case): string {
  const title = caseData.titleEn.toLowerCase();
  const diagnosis = caseData.finalDiagnosis.toLowerCase();
  if (
    title.includes("heart failure") ||
    title.includes("dilated") ||
    diagnosis.includes("heart failure")
  ) {
    return "heartFailure";
  }
  if (
    title.includes("rheumatic") ||
    title.includes("valvular") ||
    title.includes("aortic") ||
    title.includes("mitral") ||
    diagnosis.includes("stenosis") ||
    diagnosis.includes("regurgitation")
  ) {
    return "valvular";
  }
  return "default";
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let state = hashSeed(seed);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseCaseExaminerQuestions(caseData: Case): ExaminerVivaItem[] {
  try {
    const parsed = JSON.parse(caseData.examinerQuestions || "[]") as Array<
      { question?: string; sampleAnswer?: string } | string
    >;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (typeof row === "string") {
          return { question: row.trim(), sampleAnswer: "" };
        }
        return {
          question: String(row.question ?? "").trim(),
          sampleAnswer: String(row.sampleAnswer ?? "").trim(),
        };
      })
      .filter((row) => row.question);
  } catch {
    return [];
  }
}

export function pickVivaQuestionsForSession(
  sessionId: string,
  caseData: Case,
): ExaminerVivaItem[] {
  const custom = parseCaseExaminerQuestions(caseData);
  if (custom.length > 0) {
    const seed = `${sessionId}:${caseData.id}:${caseData.titleEn}:custom`;
    return seededShuffle(custom, seed).slice(0, VIVA_QUESTIONS_PER_SESSION);
  }
  const pool = QUESTION_POOLS[casePoolKey(caseData)] ?? QUESTION_POOLS.default;
  const seed = `${sessionId}:${caseData.id}:${caseData.titleEn}`;
  return seededShuffle(pool, seed)
    .slice(0, VIVA_QUESTIONS_PER_SESSION)
    .map((question) => ({ question, sampleAnswer: "" }));
}

export function isHistoryExaminerVivaStage(
  stage: string,
  maneuverId?: string,
): boolean {
  return !maneuverId && stage === HISTORY_EXAMINER_STAGE;
}

/** Legacy "Question N of M" marker — kept for sessions started before numbering was removed. */
export function parseVivaQuestionNumber(content: string): number | null {
  const match = content.match(/Question\s+(\d+)\s+of\s+\d+/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function messageContainsAnyQuestion(
  content: string,
  questions: ExaminerVivaItem[],
): boolean {
  return questions.some((item) => {
    const q = item.question?.trim();
    return !!q && q.length >= 8 && content.includes(q);
  });
}

/**
 * Current viva question (1-based). Prefers legacy "Question N of M" markers,
 * otherwise counts posed questions: opening = 1, each advancing reply (+ next
 * question text) increments, retry-only feedback does not.
 */
export function getCurrentVivaQuestionNumber(
  messages: Array<{ role: string; stage: string; content: string }>,
  stage: string,
  questions: ExaminerVivaItem[] = [],
): number {
  let maxLegacy = 0;
  for (const message of messages) {
    if (message.stage !== stage || message.role !== "EXAMINER") continue;
    const legacy = parseVivaQuestionNumber(message.content);
    if (legacy && legacy > maxLegacy) maxLegacy = legacy;
  }
  if (maxLegacy > 0) return maxLegacy;

  let posed = 0;
  let awaitingAdvance = false;
  for (const message of messages) {
    if (message.stage !== stage) continue;
    if (message.role === "STUDENT") {
      awaitingAdvance = true;
      continue;
    }
    if (message.role !== "EXAMINER") continue;

    const hasQuestion = messageContainsAnyQuestion(message.content, questions);
    const isClosing = isVivaClosingText(message.content);

    if (!awaitingAdvance) {
      if (hasQuestion) posed = Math.max(posed, 1);
      continue;
    }

    awaitingAdvance = false;
    if (isClosing) {
      posed = Math.max(posed, VIVA_QUESTIONS_PER_SESSION);
      continue;
    }
    if (hasQuestion) {
      posed = Math.min(Math.max(posed, 1) + 1, VIVA_QUESTIONS_PER_SESSION);
    }
  }

  return posed || 1;
}

export function studentGaveUp(answer: string): boolean {
  const normalized = answer.trim();
  if (!normalized) return false;
  return GAVE_UP_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isExaminerVivaComplete(
  messages: Array<{ role: string; stage: string; content: string }>,
  stage: string,
): boolean {
  return messages.some(
    (m) =>
      m.stage === stage &&
      m.role === "EXAMINER" &&
      isVivaClosingText(m.content),
  );
}

export function buildExaminerVivaOpening(
  sessionId: string,
  caseData: Case,
): string {
  const [first] = pickVivaQuestionsForSession(sessionId, caseData);
  return `Good morning. I will ask you five short viva questions for this station.\n\n${first.question}`;
}

export function getCumulativeStudentAnswerForCurrentQuestion(
  messages: Array<{ role: string; stage: string; content: string }>,
  stage: string,
  latestAnswer = "",
  currentQuestionText = "",
): { attempts: string[]; combined: string } {
  let questionStartIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.stage !== stage || message.role !== "EXAMINER") continue;
    const isCurrentQuestion =
      (currentQuestionText &&
        currentQuestionText.length >= 8 &&
        message.content.includes(currentQuestionText)) ||
      !!parseVivaQuestionNumber(message.content);
    if (isCurrentQuestion) {
      questionStartIndex = i;
      break;
    }
  }

  const attempts: string[] = [];
  const start = questionStartIndex >= 0 ? questionStartIndex + 1 : 0;
  for (let i = start; i < messages.length; i += 1) {
    const message = messages[i];
    if (message.stage === stage && message.role === "STUDENT") {
      attempts.push(message.content);
    }
  }

  if (latestAnswer.trim()) {
    attempts.push(latestAnswer.trim());
  }

  return {
    attempts,
    combined: attempts.join("\n"),
  };
}

function buildGaveUpFeedback(sampleAnswer: string, language?: string): string {
  const model = sampleAnswer.trim();
  const isAr = String(language || '').toUpperCase() !== 'EN';
  if (!model) {
    return isAr
      ? "مفيش مشكلة — كويس إنك تقول لما مش عارف. نكمّل."
      : "That's fine — it's good to acknowledge when you're unsure. Let's move on.";
  }
  return isAr
    ? `مفيش مشكلة — الإجابة المتوقعة:\n${model}`
    : `No problem — here is the expected answer:\n${model}`;
}

export async function respondToHistoryVivaAnswer(
  sessionId: string,
  caseData: Case,
  messages: Array<{ role: string; stage: string; content: string }>,
  stage: string,
  studentAnswer: string,
  language?: string,
): Promise<string> {
  const closing = getVivaClosing(language);
  if (isExaminerVivaComplete(messages, stage)) {
    return closing;
  }

  const questions = pickVivaQuestionsForSession(sessionId, caseData);
  const questionNumber = getCurrentVivaQuestionNumber(messages, stage, questions);
  const questionIndex = Math.min(questionNumber - 1, questions.length - 1);
  const currentQuestion = questions[questionIndex];
  const { combined: combinedStudentAnswer } =
    getCumulativeStudentAnswerForCurrentQuestion(
      messages,
      stage,
      studentAnswer,
      currentQuestion.question,
    );

  const evaluation = studentGaveUp(studentAnswer)
    ? {
        advance: true,
        feedback: buildGaveUpFeedback(currentQuestion.sampleAnswer, language),
      }
    : await evaluateHistoryVivaAnswer(
        caseData,
        currentQuestion.question,
        questionNumber,
        studentAnswer,
        currentQuestion.sampleAnswer,
        combinedStudentAnswer,
      );

  const feedback = evaluation.feedback.trim();

  if (!evaluation.advance) {
    return feedback;
  }

  const completedCount = questionIndex + 1;
  if (completedCount >= VIVA_QUESTIONS_PER_SESSION) {
    return `${feedback}\n\n${closing}`;
  }

  const nextQuestion = questions[completedCount];
  return `${feedback}\n\n${nextQuestion.question}`;
}
