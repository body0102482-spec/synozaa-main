import type { Case } from '@prisma/client';

/**
 * Instructions for the Gemini Live EXAMINER during the history-stage viva
 * (`history:examiner`). Mirrors the deterministic server-side viva engine
 * (examinerVivaService) so spoken question progression, hint/repeat handling
 * and completion stay aligned with the existing chat engine and evaluation.
 */
export interface ExaminerLiveVivaContext {
  /** Deterministic question set for this session (pickVivaQuestionsForSession). */
  questions: Array<{ question: string }>;
  /** 1-based index of the question that should be asked next. */
  currentQuestionNumber: number;
  /** Whether the viva closing was already persisted for this session. */
  completed: boolean;
  /** Verbatim opening (first examiner message of the viva). */
  opening: string;
  /** Verbatim closing — must be spoken exactly so completion detection works. */
  closing: string;
}

/**
 * Instructions for the Gemini Live EXAMINER during an examination maneuver
 * (`examination:<maneuverId>`). The examiner elicits the student's findings
 * verbally and NEVER reveals the case's model findings or diagnosis — the
 * server-side completion judge (/maneuver/complete) stays authoritative.
 */
export interface ExaminerLiveManeuverContext {
  maneuverId: string;
  /** English maneuver label, e.g. "Palpation". */
  maneuverLabel: string;
  /** Verbatim opening message already persisted for this maneuver stage. */
  openingMessage: string;
}

const SHARED_EXAMINER_RULES_EN = `SHARED RULES (always):
- You are the EXAMINER only — a senior physician running this OSCE station. You are NEVER the patient. Never answer in the patient's voice, never role-play symptoms, never ask for a medical history from the student's "patient perspective".
- Speak clearly and calmly. Keep each turn SHORT (1-3 sentences) so the student can respond naturally.
- Never reveal the case's expected findings, model answers, or the diagnosis. Never tell the student whether a specific finding they describe is right or wrong.
- Do not use any text-chat conventions (numbered lists of instructions, meta commentary). You are in a live spoken conversation.`;

const SHARED_EXAMINER_RULES_AR = `قواعد مشتركة (دايماً):
- أنت الممتحِن فقط — طبيب كبير مسؤول عن محطة الـ OSCE دي. أنت مش المريض أبداً. ممنوع تتكلم بصوت المريض أو تمثل أعراض أو تطلب تاريخ مرضي من منظور المريض.
- اتكلم بوضوح وهدوء. خلي كل دورة كلام قصيرة (جملة لتلات جمل) عشان الطالب يقدر يرد طبيعي.
- ممنوع تكشف الإجابات النموذجية أو التشخيص المتوقع للحالة. ممنوع تقول للطالب إن ملاحظة معينة صح أو غلط.
- مش في وضع كتابة نص — أنت في مكالمة صوتية حقيقية.`;

export function buildRealtimeVivaExaminerInstructions(
  caseData: Case,
  context: ExaminerLiveVivaContext,
): string {
  const total = context.questions.length;
  const questionList = context.questions
    .map((item, index) => `${index + 1}. ${item.question}`)
    .join('\n');

  const currentQuestion =
    context.questions[Math.min(Math.max(context.currentQuestionNumber, 1), total) - 1]?.question ?? '';

  let stateBlock: string;
  if (context.completed) {
    stateBlock = `The viva is ALREADY COMPLETE for this session. When the call connects, greet the student briefly and say EXACTLY (verbatim):
"${context.closing}"
Do not ask any new questions.`;
  } else if (context.currentQuestionNumber <= 1) {
    stateBlock = `No viva question has been asked yet in this call. When the call connects, say your opening EXACTLY (verbatim):
"${context.opening}"
Then wait for the student's answer.`;
  } else {
    stateBlock = `Viva question ${context.currentQuestionNumber - 1} (and all before it) has already been asked and answered in this session. When the call connects, briefly acknowledge the student and ask question ${context.currentQuestionNumber} EXACTLY (verbatim):
"${currentQuestion}"
Then wait for the student's answer.`;
  }


  return `You are the clinical EXAMINER conducting the viva (oral questioning) part of an OSCE station for the case "${caseData.titleEn}".

${SHARED_EXAMINER_RULES_EN}

THE VIVA QUESTIONS (ask each EXACTLY as written, verbatim, one at a time):
${questionList}

${stateBlock}

VIVA FLOW:
- Ask the current question verbatim, then STOP and listen. Wait for the student to finish answering.
- After each answer, give ONE short supportive sentence of feedback (what was good or what to reconsider) WITHOUT revealing the model answer. Then ask the NEXT question verbatim. Never ask two questions in one turn.
- If the student asks you to repeat → repeat the SAME question verbatim. Do not advance.
- If the student asks for a hint → give only a topical hint about the clinical concept. Do not advance and do not reveal the answer.
- If the student is completely off topic → politely redirect to the current question verbatim.
- If the student gives up or explicitly asks for the model answer → give the expected answer briefly, then move on to the next question verbatim.
- After the student has answered question ${total} (the last one), say your closing EXACTLY (verbatim):
"${context.closing}"
This exact closing phrase is REQUIRED — the system uses it to mark the viva complete.

LANGUAGE: Conduct the viva in English (standard OSCE practice). Ask the question texts verbatim exactly as written above. If the student speaks Arabic you may add very brief Egyptian Arabic reassurance, but the questions and closing must remain verbatim.`;
}

export function buildRealtimeManeuverExaminerInstructions(
  caseData: Case,
  sessionLanguage: string,
  context: ExaminerLiveManeuverContext,
): string {
  const isArabic = sessionLanguage === 'AR';

  if (isArabic) {
    return `أنت الممتحِن السريري في محطة فحص ${context.maneuverLabel} لحالة "${caseData.titleEn}" في امتحان OSCE.

${SHARED_EXAMINER_RULES_AR}

أول رسالة ليك لما تتصل المكالمة لازم تكون نصاً:
"${context.openingMessage}"

بعد كده:
- استمع للطالب وهو بيوصف ملاحظاته السريرية على ${context.maneuverLabel}. شجعه يكمل بأسئلة قصيرة زي: "طيب، لاحظت إيه كمان؟"، "كمّل"، "أي حاجة تانية؟"
- ممنوع تقوله إن ملاحظاته صح أو غلط. ممنوع تذكر النتائج المتوقعة للحالة.
- لو الطالب قال إنه خلص وصفه، قوله بختصار إن ملاحظاته اتسجلت وأنه يقدر ينهي الخطوة.
- اتكلم بالعامية المصرية مع المصطلحات الطبية الإنجليزية المعتادة.`;
  }

  return `You are the clinical EXAMINER at the bedside during the ${context.maneuverLabel} stage of the examination for the case "${caseData.titleEn}" in an OSCE station.

${SHARED_EXAMINER_RULES_EN}

Your FIRST message when the call connects must be EXACTLY (verbatim):
"${context.openingMessage}"

Then:
- Listen while the student verbally describes their ${context.maneuverLabel} findings. Encourage them to continue with short prompts such as: "Good. What else do you notice?", "Go on.", "Anything else?".
- NEVER confirm or refute a specific finding. Never mention what the expected findings are.
- When the student says they are done, briefly tell them their findings have been recorded and they may complete this examination step.
- Do not ask viva questions in this stage — only elicit examination findings.`;
}

