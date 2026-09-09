import type { Case } from "@prisma/client";
import {
  detectVivaStudentIntent,
  evaluateHistoryVivaAnswer,
  generateVivaModelAnswer,
  unwrapExaminerPlainText,
} from "./aiService.js";

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

export const QUESTION_SAMPLE_ANSWERS: Record<string, string> = {
  // heartFailure
  "What are the key clinical features that suggest acute decompensated heart failure in this patient?":
    "Key features include progressive dyspnea, orthopnea, paroxysmal nocturnal dyspnea (PND), elevated jugular venous pressure (JVP), bilateral basal lung crackles, and bilateral lower limb edema.",
  "How would you differentiate cardiac dyspnea from primary respiratory causes at the bedside?":
    "Cardiac dyspnea is suggested by orthopnea, PND, raised JVP, S3 gallop, and bilateral basal crackles, whereas respiratory causes typically feature wheezing, chronic productive cough, prolonged expiration, and absence of venous congestion.",
  "Which physical signs would you look for to assess volume overload?":
    "Elevated JVP (with positive hepatojugular reflux), bilateral basal pulmonary crackles, bilateral pitting lower extremity edema, ascites, and a third heart sound (S3).",
  "What is the role of BNP or NT-proBNP in evaluating breathlessness?":
    "BNP / NT-proBNP has a very high negative predictive value to rule out heart failure in acute dyspnea, and helps differentiate cardiac from pulmonary causes when clinical assessment is uncertain.",
  "Which medications improve long-term mortality in heart failure with reduced ejection fraction?":
    "The 4 pillars of guideline-directed medical therapy (GDMT): ACE inhibitors / ARB / ARNI (sacubitril/valsartan), evidence-based Beta-blockers (bisoprolol, carvedilol, metoprolol succinate), Mineralocorticoid receptor antagonists (spironolactone/eplerenone), and SGLT2 inhibitors (dapagliflozin/empagliflozin).",
  "How would you assess volume status before starting diuretics?":
    "Assess blood pressure and pulse (including orthostatic changes), JVP elevation, lung crackles, peripheral edema, daily weight, and check baseline renal function and electrolytes.",
  "What findings on chest examination would support pulmonary congestion?":
    "Bilateral fine/coarse end-inspiratory crackles (especially at lung bases) that do not clear with coughing, dullness at lung bases if pleural effusion is present, and tachypnea.",
  "What red flags would make you admit this patient urgently?":
    "Hemodynamic instability or hypotension (cardiogenic shock), severe hypoxemia / respiratory distress, acute chest pain suggesting ACS, severe pulmonary edema, or malignant arrhythmias.",
  "How does orthopnea help you in your differential diagnosis?":
    "Orthopnea is highly specific for left ventricular dysfunction and elevated pulmonary capillary wedge pressure caused by increased venous return to the heart in the supine position.",
  "What lifestyle and self-care advice is important in chronic heart failure?":
    "Daily morning weight monitoring, dietary sodium restriction (<2-3g/day), fluid restriction if needed, smoking and alcohol cessation, medication compliance, and recognizing warning signs of fluid overload.",
  "Which investigations would you order first in suspected ADHF?":
    "12-lead ECG, chest X-ray, serum BNP/NT-proBNP, complete blood count (CBC), renal function and electrolytes (urea, creatinine, K+), and urgent transthoracic echocardiogram (TTE).",
  "How would ankle swelling guide your history and examination?":
    "It indicates right heart failure / systemic venous congestion; history should evaluate timing, progression, associated dyspnea, liver/renal diseases, and medications (e.g., calcium channel blockers).",

  // valvular
  "What features in the history suggest underlying valvular heart disease?":
    "History of acute rheumatic fever in childhood, exertional dyspnea, angina, presyncope/syncope, palpitations, fatigue, and history of known heart murmurs.",
  "How does severe aortic stenosis typically present clinically?":
    "The classic symptom triad of exertional dyspnea, angina, and exertional syncope, accompanied by slow-rising pulse (pulsus parvus et tardus) and a harsh crescendo-decrescendo ejection systolic murmur radiating to carotids.",
  "What murmur characteristics help you distinguish aortic stenosis from mitral regurgitation?":
    "Aortic stenosis produces a harsh crescendo-decrescendo ejection systolic murmur best heard at the right 2nd intercostal space radiating to carotids. Mitral regurgitation produces a blowing pansystolic (holosystolic) murmur best heard at the apex radiating to the left axilla.",
  "Why is rheumatic fever history important in a young patient with dyspnea?":
    "Rheumatic heart disease is the most common cause of acquired valvular lesions (especially mitral stenosis and mixed valvular disease) in developing countries.",
  "What is the purpose of penicillin prophylaxis after rheumatic fever?":
    "Secondary antibiotic prophylaxis (e.g., monthly benzathine penicillin G) prevents recurrent Group A streptococcal pharyngitis, which stops recurrent attacks and prevents worsening valvular damage.",
  "What symptoms suggest low cardiac output in valvular disease?":
    "Exertional fatigue, lightheadedness, presyncope, exertional syncope, cool peripheries, and exertional angina due to fixed stroke volume.",
  "How would you investigate a new systolic murmur in a young adult?":
    "Transthoracic echocardiography (TTE) with Doppler to assess valve morphology and transvalvular gradients, alongside 12-lead ECG and chest radiography.",
  "What does a narrow pulse pressure suggest on examination?":
    "It reflects low stroke volume and decreased systolic ejection, characteristic of severe aortic stenosis, severe left ventricular systolic failure, or cardiogenic shock.",
  "When would you refer a patient with valvular disease for surgery?":
    "When severe valvular disease becomes symptomatic (dyspnea, angina, syncope), or in asymptomatic patients with left ventricular systolic dysfunction (LVEF < 50%), severe LV dilatation, or severe pulmonary hypertension.",
  "What are the risks of exertion in severe aortic stenosis?":
    "In severe AS, fixed cardiac output cannot meet increased peripheral demand during exercise, causing critical cerebral/coronary hypoperfusion leading to syncope, ventricular arrhythmias, or sudden cardiac death.",
  "How would paroxysmal nocturnal dyspnea change your assessment?":
    "PND indicates acute pulmonary venous congestion and left-sided cardiac decompensation with elevated left atrial pressure, signaling urgent need for medical stabilization and evaluation for valve intervention.",
  "What does a displaced heaving apex suggest?":
    "It suggests left ventricular hypertrophy and enlargement due to volume or pressure overload, commonly seen in aortic regurgitation, mitral regurgitation, or dilated cardiomyopathy.",

  // default
  "What is your leading differential diagnosis based on the history so far?":
    "The primary differential diagnosis that best fits the presenting symptom constellation and risk profile, alongside 2-3 prioritized secondary alternatives.",
  "Which features in the history are most concerning and why?":
    "Red flag features such as severe rest dyspnea, syncope, hemodynamic instability, severe chest pain, or rapid deterioration that indicate high clinical acuity.",
  "What key points would you cover in a systems review for this presentation?":
    "Cardiovascular (chest pain, palpitations, edema), respiratory (cough, hemoptysis, wheezing), gastrointestinal, renal/fluid balance, and constitutional symptoms.",
  "How would you prioritize your investigations for this case?":
    "Immediate bedside tests (vitals, ECG, bedside ultrasound), urgent baseline laboratory tests (cardiac biomarkers, CBC, electrolytes/renal function), followed by confirmatory imaging (echocardiogram/CT/X-ray).",
  "What red flags would change your management urgently?":
    "Hypotension/shock, altered mental status, severe respiratory distress/hypoxemia, intractable ischemic pain, or life-threatening arrhythmias.",
  "How would you explain your initial management plan to the patient?":
    "Explain the likely clinical diagnosis in clear, empathetic lay terms, describe immediate symptom-relief steps, outline scheduled investigations, and reassure the patient.",
  "What further history would help narrow the differential?":
    "Exact timeline and progression of symptoms, specific triggers and relieving factors, comprehensive past medical and drug history, and relevant family history.",
  "Which physical examination findings would you expect in this case?":
    "Vital sign abnormalities, specific cardiac/respiratory examination signs (murmurs, crackles, raised JVP), and signs of peripheral congestion or hypoperfusion.",
  "How would you document your clinical reasoning for the examiner?":
    "Synthesize the chief complaint, key positive and negative findings, structured prioritized differentials with clinical reasoning, and a clear diagnostic and treatment plan.",
  "What safety-net advice would you give before discharge?":
    "Explicitly outline red flag warning symptoms requiring urgent emergency re-attendance, clear medication instructions, and follow-up timeline.",
  "Which comorbidities would most affect your treatment choices?":
    "Chronic kidney disease, diabetes mellitus, hypertension, hepatic dysfunction, and underlying ischemic heart or lung disease.",
  "What is the most important question you still need to ask this patient?":
    "Clarifying the onset, progression, and severity of the primary symptom along with any life-threatening red flags.",
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
  /\bpass\b/i,
  /\bskip\b/i,
  /مش\s+عارف/i,
  /معرفش/i,
  /لا\s+أعرف/i,
  /لا\s+اعرف/i,
  /لا\s+أعلم/i,
  /لا\s+اعلم/i,
  /ما\s+اعرف/i,
  /ما\s+أعرف/i,
  /مش\s+فاكر/i,
  /مش\s+فاكرة/i,
  /مش\s+عارفه/i,
  /مش\s+عارفة/i,
  /مش\s+عرف/i,
  /مش\s+متأكد/i,
  /مش\s+متاكد/i,
  /معنديش\s+فكرة/i,
  /معنديش\s+فكره/i,
  /معنديش\s+معلومة/i,
  /معنديش\s+معلومه/i,
  /منعرفش/i,
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
          const q = row.trim();
          return { question: q, sampleAnswer: QUESTION_SAMPLE_ANSWERS[q] || "" };
        }
        const q = String(row.question ?? "").trim();
        return {
          question: q,
          sampleAnswer: String(row.sampleAnswer ?? "").trim() || QUESTION_SAMPLE_ANSWERS[q] || "",
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
    return seededShuffle(custom, seed)
      .slice(0, VIVA_QUESTIONS_PER_SESSION)
      .map((item) => ({
        question: item.question,
        sampleAnswer: item.sampleAnswer || QUESTION_SAMPLE_ANSWERS[item.question] || "",
      }));
  }
  const pool = QUESTION_POOLS[casePoolKey(caseData)] ?? QUESTION_POOLS.default;
  const seed = `${sessionId}:${caseData.id}:${caseData.titleEn}`;
  return seededShuffle(pool, seed)
    .slice(0, VIVA_QUESTIONS_PER_SESSION)
    .map((question) => ({
      question,
      sampleAnswer: QUESTION_SAMPLE_ANSWERS[question] || "",
    }));
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

export function findSampleAnswerForQuestion(question: string, fallbackSampleAnswer = ''): string {
  if (fallbackSampleAnswer && fallbackSampleAnswer.trim()) {
    return fallbackSampleAnswer.trim();
  }
  const trimmed = (question || '').trim();
  if (QUESTION_SAMPLE_ANSWERS[trimmed]) {
    return QUESTION_SAMPLE_ANSWERS[trimmed];
  }
  const qNorm = trimmed.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [key, answer] of Object.entries(QUESTION_SAMPLE_ANSWERS)) {
    const kNorm = key.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (qNorm === kNorm || (qNorm.length >= 12 && (qNorm.includes(kNorm) || kNorm.includes(qNorm)))) {
      return answer;
    }
  }
  return '';
}

async function buildGaveUpFeedback(
  caseData: Case,
  currentQuestion: ExaminerVivaItem,
  language?: string,
): Promise<string> {
  let model = findSampleAnswerForQuestion(currentQuestion.question, currentQuestion.sampleAnswer);
  const isQuestionArabic = /[\u0600-\u06ff]/.test(currentQuestion.question);
  const isAr = isQuestionArabic || String(language || '').toUpperCase() === 'AR';

  if (!model) {
    try {
      model = await generateVivaModelAnswer(caseData, currentQuestion.question, isAr ? 'AR' : 'EN');
    } catch {
      model = '';
    }
  }

  if (!model) {
    model = isAr
      ? `في حالة (${caseData.titleAr || caseData.titleEn})، الإجابة المتوقعة ترتبط بـ ${caseData.finalDiagnosis} وعلاماتها السريرية وإدارتها.`
      : `For this case (${caseData.titleEn}), the expected clinical consideration relates to ${caseData.finalDiagnosis}.`;
  }

  return isAr
    ? `مفيش مشكلة — الإجابة الصحيحة:\n${model}`
    : `No problem — here is the expected answer:\n${model}`;
}

function buildHintFeedback(question: string, sampleAnswer: string): string {
  const model = sampleAnswer.trim();
  if (!model) {
    return `Hint: focus on the clinical concept behind this question — plain English and synonyms are acceptable. Question:\n${question}`;
  }
  // Topic-only cue from the first labeled term / first short phrase — never dump full definitions.
  const firstLine = model.split(/\n/)[0]?.trim() ?? model;
  const label = firstLine.split(/:\s*/)[0]?.trim() ?? '';
  const topic =
    label && label.length <= 40 && label.split(/\s+/).length <= 5
      ? label
      : firstLine.split(/\s+/).slice(0, 4).join(' ');
  return `Hint: think about the clinical meaning related to "${topic}" — explain the concept in your own words. I will not score this hint request as an answer.`;
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

  const intent = detectVivaStudentIntent(studentAnswer);
  if (intent === 'hint') {
    return buildHintFeedback(currentQuestion.question, currentQuestion.sampleAnswer);
  }
  if (intent === 'repeat') {
    return `Of course. Here is the question again:\n${currentQuestion.question}`;
  }
  if (intent === 'clarify') {
    return `Happy to clarify — explain the clinical concept in your own words (synonyms are fine):\n${currentQuestion.question}`;
  }
  if (intent === 'off_topic') {
    return `Let's stay with this viva question:\n${currentQuestion.question}`;
  }

  const evaluation =
    intent === 'give_up' || studentGaveUp(studentAnswer)
      ? {
          advance: true,
          feedback: await buildGaveUpFeedback(caseData, currentQuestion, language),
        }
      : await evaluateHistoryVivaAnswer(
          caseData,
          currentQuestion.question,
          questionNumber,
          studentAnswer,
          currentQuestion.sampleAnswer,
          combinedStudentAnswer,
        );

  // Never leak accidental model JSON into the Examiner Box chat.
  const feedback = unwrapExaminerPlainText(evaluation.feedback);

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
