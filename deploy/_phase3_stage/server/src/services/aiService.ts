import OpenAI from 'openai';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import type { Case, Language } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getRoleKnowledgeContext, hasPatientAiKnowledge } from './knowledgeService.js';
import { parsePhysicalExamForm } from './caseFormService.js';
import { toEgyptianColloquial } from './arabicColloquial.js';
import { fixArabicSpeechTranscript } from './arabicSttFix.js';
import { logAiUsage, type AiUsageMeta } from './aiUsageService.js';
import { parseStationConfig, resolveManeuverOpeningMessage, resolveManeuverLabel } from '../lib/stationConfig.js';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SessionMessage {
  role: string;
  content: string;
  stage: string;
  createdAt?: Date | string;
}

export interface EvaluationSessionContext {
  completedManeuvers?: string[];
  durationSeconds?: number;
}

export interface EvaluationResult {
  totalScore: number;
  communicationScore: number;
  historyTakingScore: number;
  clinicalReasonScore: number;
  organizationScore: number;
  closingScore: number;
  strengths: string;
  weaknesses: string;
  missedQuestions: string;
  clinicalErrors: string;
  recommendations: string;
  idealApproach: string;
  fullReport: string;
}

function formatStageLabel(stage: string): string {
  if (stage === 'history') return 'History — Patient Interview';
  if (stage === 'history:examiner') return 'History — Examiner Viva';
  if (stage.startsWith('examination:')) {
    const maneuver = stage.split(':')[1] || 'examination';
    return `Examination — ${maneuver.charAt(0).toUpperCase()}${maneuver.slice(1)}`;
  }
  if (stage === 'diagnosis') return 'Diagnosis & Management';
  if (stage === 'investigations') return 'Investigations';
  return stage;
}

export function buildSessionTranscript(caseData: Case, messages: SessionMessage[]): string {
  const studentCount = messages.filter((m) => m.role === 'STUDENT').length;
  const lines = [
    '=== FULL OSCE SESSION TRANSCRIPT ===',
    `Case: ${caseData.titleEn}`,
    `Patient: ${caseData.patientName}, ${caseData.patientAge}y ${caseData.patientGender}`,
    `Correct Diagnosis: ${caseData.finalDiagnosis}`,
    `Chief Complaint: ${caseData.chiefComplaint}`,
    `Teaching Points: ${caseData.teachingPoints}`,
    `Evaluation Rubric: ${caseData.evaluationRubric}`,
    `Student messages: ${studentCount} | Total messages: ${messages.length}`,
    '',
  ];

  let currentStage = '';
  for (const msg of messages) {
    if (msg.stage !== currentStage) {
      currentStage = msg.stage;
      lines.push(`\n--- ${formatStageLabel(currentStage)} ---`);
    }
    lines.push(`[${msg.role}]: ${msg.content}`);
  }

  return lines.join('\n');
}

function clampScore(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeEvaluation(
  raw: Partial<EvaluationResult>,
  fallback: EvaluationResult
): EvaluationResult {
  return {
    totalScore: clampScore(raw.totalScore, fallback.totalScore),
    communicationScore: clampScore(raw.communicationScore, fallback.communicationScore),
    historyTakingScore: clampScore(raw.historyTakingScore, fallback.historyTakingScore),
    clinicalReasonScore: clampScore(raw.clinicalReasonScore, fallback.clinicalReasonScore),
    organizationScore: clampScore(raw.organizationScore, fallback.organizationScore),
    closingScore: clampScore(raw.closingScore, fallback.closingScore),
    strengths: String(raw.strengths || fallback.strengths),
    weaknesses: String(raw.weaknesses || fallback.weaknesses),
    missedQuestions: String(raw.missedQuestions || fallback.missedQuestions),
    clinicalErrors: String(raw.clinicalErrors || fallback.clinicalErrors),
    recommendations: String(raw.recommendations || fallback.recommendations),
    idealApproach: String(raw.idealApproach || fallback.idealApproach),
    fullReport: String(raw.fullReport || fallback.fullReport),
  };
}

function hasPattern(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function buildPatientSystemPrompt(
  caseData: Case,
  language: Language,
  knowledgeContext: string,
  voiceTurn = false,
  studentTurn = 0,
): string {
  const personality = caseData.patientPersonality || 'Cooperative Egyptian patient, anxious about symptoms';
  const scenario = caseData.scenarioPrompt || 'Standard OSCE patient encounter';
  const nameAr = patientNameInLang(caseData, true);

  if (voiceTurn) {
    const langNote =
      language === 'EN'
        ? 'Respond ONLY in English. One short sentence.'
        : 'عامية مصرية طبيعية — جملة أو اتنين بس. ممنوع الفصحى والإنجليزي.';
    const personaNote = knowledgeContext.includes('ADMIN AI KNOWLEDGE')
      ? '\nFollow ADMIN AI KNOWLEDGE persona below (tone/dialect/gendered speech).'
      : '';
    return `Live OSCE voice call. You are ${caseData.patientName}, ${caseData.patientAge}y, ${caseData.patientGender}.
Chief complaint: ${caseData.chiefComplaint}
Personality: ${personality}
${langNote}${personaNote}
Rules: if the doctor asks several short factual questions together (name, age, where you live), answer all briefly in 1–2 sentences; otherwise focus on the main question; never state diagnosis (${caseData.finalDiagnosis}); lay language only.${knowledgeContext}`;
  }

  const langNote =
    language === 'AR'
      ? voiceTurn
        ? `VOICE CALL — مريض مصري في مكالمة صوتية. افهم المعنى مش الكلمات الحرفية. عامية مصرية طبيعية، جملة أو اتنين. ممنوع الفصحى والإنجليزي.`
        : `اكتب بعامية مصرية طبيعية زي مريض حقيقي قاعد قدام الدكتور في العيادة — مش روبوت ولا فصحى.
أمثلة على الأسلوب المطلوب (المحتوى لازم ييجي من بيانات الحالة فقط):
- "صباح النور يا دكتور. والله يا دكتور أنا تعبان أوي، [اذكر الشكوى من بيانات الحالة]."
- "الله يسلمك يا دكتور، تسلم. [ثم اذكر تأثير المرض على حياتك من بيانات الحالة]."
- "اسمي ${nameAr}."
استخدم كلمات طبيعية: والله، أوي، يا دكتور، مش، عشان، كده.
٢–٤ جمل لما تحكي عن أعراضك أو مشاعرك؛ جملة أو اتنين للأسئلة الواقعية (الاسم، السن، السكن).`
      : language === 'EN'
        ? voiceTurn
          ? 'Respond ONLY in English. One or two short sentences.'
          : 'Respond ONLY in English. Sound like a real patient (2–4 sentences when describing symptoms).'
        : 'Match the doctor language: Egyptian Arabic or English, natural spoken style.';

  const phaseNote =
    studentTurn === 0
      ? `FIRST CONTACT: If the doctor greets or introduces themselves, reply warmly (صباح الخير/أهلاً يا دكتور) and briefly say you are not well and what is bothering you most — 2–3 natural sentences from the case background. Do not dump full history.`
      : `ONGOING INTERVIEW: Answer the doctor's current question directly in natural spoken Arabic. You may use 2–4 sentences when describing symptoms, daily impact, or feelings. For simple facts (name, age, yes/no) keep it short but still natural.`;

  const voiceRules = voiceTurn
    ? `VOICE RULES:
- Very brief: 1–2 sentences max.
- One topic per answer.`
    : `CHAT RULES:
- Sound human — vary tone with personality: ${personality}
- When the doctor shows empathy (سلامة، ربنا يشفيك) → thank them warmly; you may add one sentence about how illness affects your life.
- The doctor speaks natural Egyptian colloquial Arabic (عامية): understand "هيلو/أهلاً" as greeting, "عامل إيه/إزيك/ايه الأخبار" as asking how you feel, "اسمك ايه" as name, etc.
- If the doctor asks multiple questions in one message (e.g. name + age + where you live), answer ALL of them naturally in one reply.
- Only if the question is truly unclear (single word like "أيه" alone) → "مش فاهم قصدك يا دكتور، ممكن توضّح سؤالك؟"
- Never ask the doctor questions back. Never state the diagnosis (${caseData.finalDiagnosis}).`;

  const personaOverride = knowledgeContext.includes('ADMIN AI KNOWLEDGE')
    ? `
PERSONA PRIORITY (from ADMIN AI KNOWLEDGE below):
- Follow ADMIN AI KNOWLEDGE for speech style, dialect, gendered Arabic forms, tone, and elderly/woman/man persona.
- Persona rules override default presentation; keep clinical facts (symptoms, duration, history) from CASE BACKGROUND only.
- Answer the doctor's CURRENT question directly (e.g. "where is the pain?" → say the body location in character).
`
    : '';

  return `You are a simulated Egyptian patient in an OSCE clinical examination. Stay fully in character as ${caseData.patientName}, ${caseData.patientAge} years old.
${personaOverride}

CASE BACKGROUND (use when relevant to the question — do not recite everything at once):
- Chief complaint: ${caseData.chiefComplaint}
- Medical history: ${caseData.medicalHistory}
- Medications: ${caseData.medicationHistory}
- Surgical history: ${caseData.surgicalHistory}
- Family history: ${caseData.familyHistory}
- Social history: ${caseData.socialHistory}
- Personality: ${personality}
- Scenario notes: ${scenario}

${phaseNote}

${voiceRules}
- CRITICAL: Only reveal facts from CASE BACKGROUND and scenario notes above. Never invent symptoms, history, medications, or details not configured for this case.
- Lay language only — no medical jargon or English disease terms.
- ${langNote}
${knowledgeContext}`;
}

function pickLang(en: string, ar: string, lang: 'AR' | 'EN'): string {
  return lang === 'AR' ? ar : en;
}

function textHasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function mergeEvaluationWithLanguage(
  ai: EvaluationResult,
  localized: EvaluationResult,
  lang: 'AR' | 'EN'
): EvaluationResult {
  if (lang === 'EN') return ai;

  const pick = (aiText: string, localizedText: string) =>
    textHasArabic(aiText) ? aiText : localizedText;

  return {
    ...ai,
    strengths: pick(ai.strengths, localized.strengths),
    weaknesses: pick(ai.weaknesses, localized.weaknesses),
    missedQuestions: pick(ai.missedQuestions, localized.missedQuestions),
    clinicalErrors: pick(ai.clinicalErrors, localized.clinicalErrors),
    recommendations: pick(ai.recommendations, localized.recommendations),
    idealApproach: pick(ai.idealApproach, localized.idealApproach),
    fullReport: pick(ai.fullReport, localized.fullReport),
  };
}

export function resolveEvaluationLanguage(
  sessionLang: Language,
  messages: SessionMessage[],
  uiLang?: string
): 'AR' | 'EN' {
  if (uiLang === 'AR' || uiLang === 'EN') return uiLang;
  if (sessionLang === 'AR') return 'AR';
  if (sessionLang === 'EN') return 'EN';
  const studentText = messages
    .filter((m) => m.role === 'STUDENT')
    .map((m) => m.content)
    .join(' ');
  return /[\u0600-\u06FF]/.test(studentText) ? 'AR' : 'EN';
}

function buildExaminerEvaluationPrompt(
  caseData: Case,
  knowledgeContext: string,
  lang: 'AR' | 'EN'
): string {
  const langRule =
    lang === 'AR'
      ? '7. Write ALL string fields (strengths, weaknesses, missedQuestions, clinicalErrors, recommendations, idealApproach, fullReport) ONLY in Arabic (Egyptian medical Arabic when appropriate).'
      : '7. Write ALL string fields (strengths, weaknesses, missedQuestions, clinicalErrors, recommendations, idealApproach, fullReport) ONLY in English.';

  const caseTitle = lang === 'AR' ? caseData.titleAr || caseData.titleEn : caseData.titleEn;

  return `You are a senior OSCE clinical examiner. You will receive the COMPLETE transcript of a student's OSCE session (history, examination viva, diagnosis, and all examiner interactions).

CASE CONTEXT:
- Title: ${caseTitle}
- Correct Diagnosis: ${caseData.finalDiagnosis}
- Chief Complaint: ${caseData.chiefComplaint}
- Key Teaching Points: ${caseData.teachingPoints}
- Scoring Rubric: ${caseData.evaluationRubric}
- Physical Exam Findings (expected): ${caseData.physicalExam}

INSTRUCTIONS:
1. Read EVERY [STUDENT] message across ALL stages before scoring.
2. Score based on what the student ACTUALLY did — not generic defaults.
3. Compare their history questions, exam descriptions, and final diagnosis against the case data.
4. Identify specific missed questions, clinical errors, and strengths from the transcript.
5. Write the fullReport as a detailed markdown evaluation referencing specific student actions.
6. Return ONLY valid JSON — no markdown fences, no extra text.
${langRule}

JSON structure (all scores 0-100 integers):
{
  "totalScore": number,
  "communicationScore": number,
  "historyTakingScore": number,
  "clinicalReasonScore": number,
  "organizationScore": number,
  "closingScore": number,
  "strengths": "string — specific strengths from transcript",
  "weaknesses": "string — specific gaps observed",
  "missedQuestions": "string — questions they should have asked but did not",
  "clinicalErrors": "string — errors or unsafe reasoning",
  "recommendations": "string — actionable study recommendations",
  "idealApproach": "string — how an excellent candidate would approach this case",
  "fullReport": "string — comprehensive markdown report covering history, exam, diagnosis, and overall performance"
}${knowledgeContext ? `\n\nDomain knowledge for scoring:\n${knowledgeContext}` : ''}`;
}

async function getAISettings() {
  const defaultModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
  let settings = await prisma.aISettings.findFirst();
  if (!settings) {
    settings = await prisma.aISettings.create({
      data: {
        provider: process.env.AI_PROVIDER || 'openai',
        patientModel: defaultModel,
        examinerModel: defaultModel,
      },
    });
  }

  // One-time migrate legacy prompts → patient prompts
  if (
    (settings.systemPromptAr || settings.systemPromptEn) &&
    !settings.patientSystemPromptAr &&
    !settings.patientSystemPromptEn
  ) {
    settings = await prisma.aISettings.update({
      where: { id: settings.id },
      data: {
        patientSystemPromptAr: settings.systemPromptAr,
        patientSystemPromptEn: settings.systemPromptEn,
      },
    });
  }

  return {
    ...settings,
    provider: process.env.AI_PROVIDER || settings.provider,
    patientModel:
      process.env.OPENAI_PATIENT_MODEL ||
      settings.patientModel ||
      'gpt-4o-mini',
    examinerModel: process.env.OPENAI_EXAMINER_MODEL || process.env.OPENAI_MODEL || settings.examinerModel || defaultModel,
    maxContextMessages: settings.maxContextMessages ?? 12,
  };
}

let aiSettingsCache: { value: Awaited<ReturnType<typeof getAISettings>>; expiresAt: number } | null = null;

export function clearAISettingsCache() {
  aiSettingsCache = null;
}

async function getAISettingsCached() {
  const now = Date.now();
  if (aiSettingsCache && aiSettingsCache.expiresAt > now) {
    return aiSettingsCache.value;
  }
  const value = await getAISettings();
  aiSettingsCache = { value, expiresAt: now + 60_000 };
  return value;
}

function adminSystemPromptSuffix(
  settings: Awaited<ReturnType<typeof getAISettings>>,
  lang: 'AR' | 'EN',
  role: 'patient' | 'examiner' = 'patient',
): string {
  let custom: string | null | undefined;
  if (role === 'examiner') {
    custom = lang === 'AR' ? settings.examinerSystemPromptAr : settings.examinerSystemPromptEn;
  } else {
    custom =
      (lang === 'AR' ? settings.patientSystemPromptAr : settings.patientSystemPromptEn) ||
      (lang === 'AR' ? settings.systemPromptAr : settings.systemPromptEn);
  }
  return custom?.trim() ? `\n\nADMIN SYSTEM PROMPT:\n${custom.trim()}` : '';
}

function contextWindow(history: { role: string; content: string }[], maxMessages: number) {
  const n = Math.max(2, Math.min(maxMessages || 12, 100));
  return history.slice(-n);
}

/** Tighter window for live chat turns — less input tokens, faster responses. */
const CHAT_CONTEXT_CAP = 8;
const VOICE_CONTEXT_CAP = 6;
const CHAT_PATIENT_MAX_TOKENS = 80;
const CHAT_EXAMINER_MAX_TOKENS = 64;
const VOICE_PATIENT_MAX_TOKENS = 48;
const VOICE_TIMEOUT_MS = 1500;
const CHAT_TIMEOUT_MS = 2200;

function chatContextWindow(history: { role: string; content: string }[], maxMessages: number, voiceTurn = false) {
  return contextWindow(history, Math.min(maxMessages, voiceTurn ? VOICE_CONTEXT_CAP : CHAT_CONTEXT_CAP));
}

function usesMaxCompletionTokens(model: string): boolean {
  const m = model.toLowerCase();
  return /^(gpt-5|o1|o3|o4)/.test(m);
}

function supportsCustomTemperature(model: string): boolean {
  const m = model.toLowerCase();
  return !/^(gpt-5|o1|o3|o4)/.test(m);
}

function effectiveCompletionBudget(model: string, maxTokens: number, fastChat = false): number {
  // Reasoning models (gpt-5, o-series) may consume budget internally before visible text.
  if (usesMaxCompletionTokens(model)) {
    return fastChat ? Math.max(maxTokens, 160) : Math.max(maxTokens, 512);
  }
  return maxTokens;
}

function isReasoningModel(model: string): boolean {
  return usesMaxCompletionTokens(model);
}

/** Realtime models are not valid for text chat completions — avoid a slow failed-then-fallback round trip. */
function chatPatientModel(settings: Awaited<ReturnType<typeof getAISettings>>): string {
  const configured = settings.patientModel;
  if (!/realtime/i.test(configured)) return configured;
  return (
    process.env.OPENAI_PATIENT_MODEL ||
    process.env.OPENAI_MODEL ||
    settings.examinerModel ||
    'gpt-4o-mini'
  );
}

function extractCompletionText(response: ChatCompletion): string {
  return response.choices[0]?.message?.content?.trim() || '';
}

async function callOpenAI(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  usageMeta?: AiUsageMeta,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const openai = new OpenAI({ apiKey });
  const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';

  const run = (activeModel: string, tokenBudget: number, fastChat = true) =>
    openai.chat.completions.create({
      model: activeModel,
      messages,
      ...(supportsCustomTemperature(activeModel) ? { temperature } : {}),
      ...(usesMaxCompletionTokens(activeModel)
        ? {
            max_completion_tokens: effectiveCompletionBudget(activeModel, tokenBudget, fastChat),
            ...(fastChat && isReasoningModel(activeModel)
              ? {
                  reasoning_effort: 'minimal' as 'low',
                  verbosity: 'low' as const,
                }
              : {}),
          }
        : { max_tokens: tokenBudget }),
    } as Parameters<typeof openai.chat.completions.create>[0]);

  const record = (activeModel: string, response: ChatCompletion, success: boolean, error?: string) => {
    if (!usageMeta) return;
    void logAiUsage({
      feature: usageMeta.feature,
      model: activeModel,
      usage: response.usage,
      userId: usageMeta.userId,
      sessionId: usageMeta.sessionId,
      success,
      error,
    });
  };

  try {
    let response = (await run(model, maxTokens)) as ChatCompletion;
    let text = extractCompletionText(response);
    if (!text && model !== fallbackModel) {
      response = (await run(fallbackModel, Math.max(maxTokens, 220))) as ChatCompletion;
      text = extractCompletionText(response);
      record(fallbackModel, response, !!text, text ? undefined : 'empty model response');
    } else {
      record(model, response, !!text, text ? undefined : 'empty model response');
    }
    return text;
  } catch (error) {
    if (model !== fallbackModel && /realtime|gpt-5/i.test(model)) {
      const response = (await run(fallbackModel, Math.max(maxTokens, 220))) as ChatCompletion;
      record(fallbackModel, response, true);
      return extractCompletionText(response);
    }
    if (usageMeta) {
      void logAiUsage({
        feature: usageMeta.feature,
        model,
        userId: usageMeta.userId,
        sessionId: usageMeta.sessionId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

function logAiFallback(context: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.warn(`[AI] ${context} — OpenAI unavailable, using mock fallback: ${msg}`);
}

async function callOpenAISafe(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  fallback: () => string,
  usageMeta?: AiUsageMeta,
  options?: { timeoutMs?: number },
): Promise<string> {
  const started = Date.now();
  try {
    const completion = callOpenAI(messages, model, temperature, maxTokens, usageMeta);
    const text = options?.timeoutMs
      ? (
          await Promise.race([
            completion,
            new Promise<string>((_, reject) => {
              setTimeout(() => reject(new Error('ai-timeout')), options.timeoutMs);
            }),
          ])
        ).trim()
      : (await completion).trim();
    const elapsed = Date.now() - started;
    if (elapsed > VOICE_TIMEOUT_MS) {
      console.warn(`[AI] slow completion ${elapsed}ms feature=${usageMeta?.feature ?? 'unknown'}`);
    }
    if (!text) {
      logAiFallback('chat completion', new Error('empty model response'));
      return fallback();
    }
    return text;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logAiFallback(reason === 'ai-timeout' ? 'chat completion timeout' : 'chat completion', error);
    return fallback();
  }
}

function resolvePatientLanguage(language: Language, userMessage: string): boolean {
  if (language === 'AR') return true;
  if (language === 'EN') return false;
  return /[\u0600-\u06FF]/.test(userMessage);
}

function effectivePatientLanguage(language: Language, userMessage: string): 'AR' | 'EN' {
  return resolvePatientLanguage(language, userMessage) ? 'AR' : 'EN';
}

function resolveExaminerLanguage(sessionLang: Language, studentMessage: string): 'AR' | 'EN' {
  if (sessionLang === 'EN') return 'EN';
  if (sessionLang === 'AR') return 'AR';
  return /[\u0600-\u06FF]/.test(studentMessage) ? 'AR' : 'AR';
}

/** Physical examination viva — examiner always speaks English. */
function examinationExaminerLanguage(): 'EN' {
  return 'EN';
}

function examinerLangRule(lang: 'AR' | 'EN'): string {
  return lang === 'AR'
    ? 'ردّ فقط بالعامية المصرية الطبية الطبيعية، مش فصحى. جمل قصيرة 2–4. ممنوع الإنجليزي إلا لمصطلحات طبية لاتينية ضرورية بين قوسين.'
    : 'Respond ONLY in English (2–4 sentences).';
}

function isMostlyEnglish(text: string): boolean {
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return latin >= 3 && arabic === 0;
}

function containsEnglishMedicalLeak(text: string): boolean {
  return /progressive|exertional|dyspnea|tightness|shortness|breath|swelling|chest pain|months/i.test(
    text,
  );
}

function finalizePatientReply(
  caseData: Case,
  userMessage: string,
  response: string,
  lang: Language,
  history: { role: string; content: string }[] = [],
  voiceTurn = false,
): string {
  const maxSentences = voiceTurn ? 2 : 5;
  if (lang === 'EN') return truncatePatientAnswer(response.trim(), maxSentences);

  let text = truncatePatientAnswer(response.trim(), maxSentences);

  if (!voiceTurn && (isMostlyEnglish(text) || containsEnglishMedicalLeak(text))) {
    const fallback = getDeterministicPatientResponse(caseData, userMessage, 'AR', history);
    if (fallback) return fallback;
    if (asksWellbeing(userMessage)) return patientWellbeingReply(caseData, true, false);
    if (asksAboutSymptoms(userMessage)) return patientComplaintPhrase(caseData, true);
    if (asksName(userMessage)) return `اسمي ${patientNameInLang(caseData, true)}.`;
    if (isGreetingOnly(userMessage) || isDoctorIntroduction(userMessage)) {
      return patientOpeningReply(caseData, true);
    }
    return 'مش فاهم، ممكن توضّح سؤالك؟';
  }

  text = enforcePatientLanguage(text, true);
  if (caseData.patientName && text.includes(caseData.patientName)) {
    text = text.replaceAll(caseData.patientName, patientNameInLang(caseData, true));
  }
  return toEgyptianColloquial(text);
}

function finalizeExaminerReply(text: string, lang: 'AR' | 'EN'): string {
  const trimmed = text.trim();
  if (!trimmed || lang === 'EN') return trimmed;
  return toEgyptianColloquial(trimmed);
}

export function normalizeStudentMessage(message: string, sessionLang: Language): string {
  const trimmed = message.trim();
  if (sessionLang === 'EN') return trimmed;
  const sttFixed = fixArabicSpeechTranscript(trimmed, true);
  return normalizeEgyptianColloquialInput(sttFixed);
}

function normalizeEgyptianColloquialInput(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return t;

  const fixes: Array<[RegExp, string]> = [
    [/^(هيلو|هالو|حيلو|هلو|هلا)\s*(يا\s*)?(دكتور)?[!.?؟]*$/i, 'اهلا دكتور'],
    [/^(هاي|hi|hello|hey)\s*(يا\s*)?(دكتور|doctor)?[!.?؟]*$/i, 'اهلا دكتور'],
    [/^(عامل|عاملة)\s*(ايه|إيه|أي|eh|eih)\s*(يا\s*)?(دكتور)?[!.?؟]*$/i, 'عامل إيه'],
    [/^(ازيك|إزيك|ازي|إزي)\s*(يا\s*)?(دكتور)?[!.?؟]*$/i, 'إزيك'],
    [/^(ايه|إيه|اي)\s*(الاخبار|الأخبار|اخبارك|أخبارك)\s*(يا\s*)?(دكتور)?[!.?؟]*$/i, 'إيه الأخبار'],
  ];

  for (const [pattern, replacement] of fixes) {
    if (pattern.test(t)) return replacement;
  }

  return t;
}

function patientNameInLang(caseData: Case, isArabic: boolean): string {
  if (!isArabic) return caseData.patientName;
  const lower = caseData.patientName.toLowerCase();
  if (lower.includes('tarek')) return 'طارق مصطفى الحداد';
  if (lower.includes('samira')) return 'سميرة عبد الرحمن';
  if (lower.includes('ahmed')) return 'أحمد';
  if (lower.includes('fatma') || lower.includes('fatima')) return 'فاطمة';
  if (lower.includes('mohamed') || lower.includes('mohammed')) return 'محمد';
  return caseData.patientName.split(' ').slice(0, 2).join(' ');
}

function patientComplaintPhrase(caseData: Case, isArabic: boolean): string {
  if (!isArabic) return caseData.chiefComplaint.split('.')[0].trim();

  const c = caseData.chiefComplaint.toLowerCase();
  const months = c.match(/(\d+)\s*months?/);
  const weeks = c.match(/(\d+)\s*-?\s*weeks?/);
  const duration = months
    ? `من ${months[1]} شهور`
    : weeks
      ? `من ${weeks[1]} أسابيع`
      : /أسبوع|اسبوع|week/i.test(c)
        ? 'من أسبوعين'
        : 'من فترة';

  if (/dyspnea|breath|shortness|exertional|ضيق|تنفس|نفس/i.test(c)) {
    return `${duration} بحس بضيق نفس مع المجهود.`;
  }
  // Avoid treating epigastric/abdominal "pain" as chest pain.
  if (
    /chest|tight|صدر/i.test(c) ||
    (/(?:ألم|الم|وجع|pain)\s*(?:في|فى|of)?\s*(?:ال)?صدر/i.test(c) &&
      !/epigastr|بطن|abdomen|stomach|gastro|ulcer|قرحة/i.test(c))
  ) {
    return `${duration} عندي ألم/تقل في الصدر.`;
  }
  if (/epigastr|بطن|abdomen|stomach|gastro|ulcer|قرحة|حرقان/i.test(c)) {
    return `${duration} عندي ألم/حرقان في فم المعدة.`;
  }
  if (/[\u0600-\u06FF]/.test(caseData.chiefComplaint)) {
    return `${duration} ${caseData.chiefComplaint.split('.')[0].trim()}.`;
  }
  return `${duration} عندي شكوى بقت معايا.`;
}

function isVagueStudentMessage(text: string): boolean {
  const t = text.trim();
  return /^(أ?ييه|ايه|إيه|اي|eh|eih|أيه)\s*[؟?.!]*$/i.test(t) || t.length < 3;
}

function isEmpathyOrBlessing(text: string): boolean {
  const t = text.trim();
  return /الف\s*(مليون\s*)?سلام|مليون\s*سلام|سلام[ةه]\s*(عليك|عليكي)?|سلامتك|ربنا\s*يخليك|ربنا\s*يشفيك|الله\s*يسلمك|get\s*well|bless\s*you/i.test(
    t,
  );
}

function isGreetingOnly(text: string): boolean {
  const t = text
    .trim()
    .replace(/[!.?؟،,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/أهلاً|أهلا|اهلاً/gi, 'اهلا')
    .trim();
  if (!t || t.length > 80) return false;

  if (
    /^(السلام عليكم|سلام عليكم|صباح الخير|مساء الخير|good morning|good afternoon|good evening)(\s+(يا\s*)?دكتور)?$/i.test(
      t,
    )
  ) {
    return true;
  }

  const core = t.replace(/\s*(يا\s+)?دكتور\s*$/i, '').trim() || t;
  const words = core.split(' ').filter(Boolean);
  const wordGreeting =
    /^(أ?هلا|اهلا|مرحبا?|مرحب|سلام|السلام|هاي|hi|hello|hey|عليكم|هيلو|هالو|حيلو|هلو|هلا)$/i;
  return words.length > 0 && words.length <= 5 && words.every((w) => wordGreeting.test(w));
}

function quickSocialPatientReply(
  caseData: Case,
  userMessage: string,
  lang: Language,
  history: { role: string; content: string }[],
  voiceTurn: boolean,
): string | null {
  const isArabic = resolvePatientLanguage(lang, userMessage);
  const studentTurn = history.filter((m) => m.role === 'STUDENT').length;

  if (isEmpathyOrBlessing(userMessage)) {
    return patientEmpathyReply(caseData, isArabic);
  }

  if (isGreetingOnly(userMessage) || isDoctorIntroduction(userMessage)) {
    if (studentTurn === 0) {
      return voiceTurn
        ? patientWellbeingReply(caseData, isArabic, true)
        : patientOpeningReply(caseData, isArabic);
    }
    return isArabic ? 'أهلاً يا دكتور.' : 'Hello doctor.';
  }

  if (asksWellbeing(userMessage)) {
    // If the doctor mixed wellbeing with other questions (name/age/...),
    // don't answer wellbeing alone — let the multi-intent combiner handle it.
    const intents = resolvePatientQuestionIntents(userMessage);
    const hasOtherFacts = intents.some(
      (intent) =>
        intent !== 'wellbeing' &&
        intent !== 'greeting' &&
        intent !== 'empathy',
    );
    if (hasOtherFacts) return null;
    return patientWellbeingReply(caseData, isArabic, voiceTurn);
  }

  return null;
}

function firstSentences(text: string, max = 2): string {
  const cleaned = text.trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/(?<=[.!?؟])\s+/).filter(Boolean);
  return parts.slice(0, max).join(' ').trim();
}

function pickArabicCaseText(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && /[\u0600-\u06FF]/.test(value)) return value;
  }
  return '';
}

/** Case-specific patient narrative from admin fields — no hardcoded persona scripts. */
function patientScenarioSnippet(caseData: Case, isArabic: boolean): string {
  const scenario = caseData.scenarioPrompt?.trim() ?? '';
  const chief = caseData.chiefComplaint?.trim() ?? '';
  const social = caseData.socialHistory?.trim() ?? '';
  const personality = caseData.patientPersonality?.trim() ?? '';

  if (isArabic) {
    const arabicBlock = pickArabicCaseText(scenario, chief, social, personality);
    if (arabicBlock) return firstSentences(arabicBlock, 2);

    const complaint = patientComplaintPhrase(caseData, true);
    const socialSnippet = /[\u0600-\u06FF]/.test(social) ? firstSentences(social, 1) : '';
    return [complaint, socialSnippet].filter(Boolean).join(' ').trim();
  }

  return (
    firstSentences(scenario, 2) ||
    firstSentences(chief, 2) ||
    patientComplaintPhrase(caseData, false)
  );
}

function patientRichComplaint(caseData: Case, isArabic: boolean): string {
  if (!isArabic) {
    return patientScenarioSnippet(caseData, false) || patientComplaintPhrase(caseData, false);
  }

  const narrative = patientScenarioSnippet(caseData, true);
  if (!narrative) {
    return `والله يا دكتور مش في أحسن حالي. ${patientComplaintPhrase(caseData, true)}`;
  }
  if (/^والله/i.test(narrative)) return narrative;
  return `والله يا دكتور ${narrative}`;
}

function patientWellbeingReply(caseData: Case, isArabic: boolean, voiceTurn: boolean): string {
  if (!isArabic) return voiceTurn ? 'Not great, doctor.' : 'Honestly doctor, I have not been feeling well lately.';
  if (voiceTurn) return 'مش في أحسن حالي دكتور.';
  const hint = patientComplaintPhrase(caseData, true);
  return `والله يا دكتور مش في أحسن حالي، تعبان${caseData.patientGender.toLowerCase().startsWith('f') ? 'ة' : ''} أوي. ${hint}`;
}

function patientOpeningReply(caseData: Case, isArabic: boolean): string {
  if (!isArabic) {
    const snippet = patientScenarioSnippet(caseData, false) || patientComplaintPhrase(caseData, false);
    return `Hello doctor. I have not been feeling well — ${snippet}`;
  }

  const greeting = 'أهلاً يا دكتور.';
  const narrative = patientScenarioSnippet(caseData, true) || patientRichComplaint(caseData, true);
  if (/^أهلاً|^والله/i.test(narrative)) return `${greeting} ${narrative}`;
  return `${greeting} ${narrative}`;
}

function patientEmpathyReply(caseData: Case, isArabic: boolean): string {
  if (!isArabic) {
    const snippet = patientScenarioSnippet(caseData, false);
    return snippet ? `Thank you, doctor. ${snippet}` : 'Thank you, doctor. I really appreciate it.';
  }

  const thanks = caseData.patientGender.toLowerCase().startsWith('f')
    ? 'الله يسلمك يا دكتور، تسلمي.'
    : 'الله يسلمك يا دكتور، تسلم.';
  const narrative = patientScenarioSnippet(caseData, true);
  if (!narrative) return thanks;
  if (/^والله/i.test(narrative)) return `${thanks} ${narrative}`;
  return `${thanks} ${narrative}`;
}

function truncatePatientAnswer(text: string, maxSentences = 2): string {
  const cleaned = text.trim();
  if (!cleaned) return cleaned;
  const parts = cleaned.split(/(?<=[.!?؟])\s+/).filter(Boolean);
  if (parts.length <= maxSentences) return cleaned;
  return parts.slice(0, maxSentences).join(' ').trim();
}

function enforcePatientLanguage(text: string, isArabic: boolean): string {
  const trimmed = text.trim();
  if (!trimmed || !isArabic) return trimmed;

  const latin = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const arabic = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
  if (latin >= 3 && arabic === 0) {
    return 'مش فاهم، ممكن توضّح سؤالك؟';
  }
  return trimmed;
}

function isDoctorIntroduction(text: string): boolean {
  return /^(good\s+(morning|afternoon|evening)|nice to meet|pleased to meet|i'?m\s+(dr|doctor)|my name is.*(dr|doctor)|أنا\s+(د|دكتور)|اسمي\s+(د|دكتور)|تشرفنا|نورت)/i.test(
    text.trim(),
  );
}

function asksAboutSymptoms(text: string): boolean {
  if (isVagueStudentMessage(text)) return false;
  if (
    asksName(text) ||
    asksAge(text) ||
    asksWellbeing(text) ||
    asksNationality(text) ||
    asksMaritalStatus(text) ||
    asksGender(text) ||
    isGreetingOnly(text) ||
    isEmpathyOrBlessing(text)
  ) {
    return false;
  }
  return /why|what brought|what brings|present|complain|symptom|problem|chief|feel|wrong|happening|issue|breath|dyspnea|swell|pain|chest|tell me about|describe|history of|ليه|سبب|شكو|شكوى|شكواك|شكوتك|شكوايتك|بتشتكي|بتشكو|تشتكي|اشتكي|اشتكيت|بتشكو|عرض|وجع|ألم|الم|ضيق|تنفس|تورم|حاس|حاسس|بتعاني|تعاني من|مشكل|إيه اللي|إيه الحاجة|الحاجة اللي|إيه المشكلة|إيه مشكل|إيه جابك|جابك هنا|جيت ليه|ليه جيت|وديجتي|ودجتي|وش جيت|عندك إيه|عندك ايه|إيه اللي عندك|ما الذي|شكو.*من|بتشتكي\s*من|تشتكي\s*من|what.*wrong|what.*problem|what.*matter|what.*complain/i.test(
    text,
  );
}

function asksName(text: string): boolean {
  return /(?:name|your name|اسم|اسمك|who are you|مين|من انت|may i have your name|what is your name|اسمك\s*إ?يه|اسمك\s*ايه|اسم حضرتك)/i.test(
    text,
  );
}

function asksAge(text: string): boolean {
  return /(?:how\s*old|years?\s*old|your\s*age)|(?:عمرك|سنك|(?:كم|كام)\s*عمر|(?:كم|كام)\s*سنة|(?:كم|كام)\s*سن|عندك\s*(?:كم|كام)\s*سنة|عندك\s*(?:كم|كام)\s*سن)/i.test(
    text,
  );
}

function asksPriorDoctorVisit(text: string): boolean {
  return /روحت.*دكتور|رحت.*دكتور|زرت.*دكتور|دكتور قبل|مستشفى قبل|seen a doctor|doctor before|visited.*doctor|hospital before|previous doctor/i.test(
    text,
  );
}

function asksResidence(text: string): boolean {
  return /ساكن فين|ساكنة فين|عايش فين|عايشة فين|ساكن في|منين|من فين|where.*live|where do you live|your address|بتسكن/i.test(
    text,
  );
}

function patientPriorDoctorPhrase(caseData: Case, isArabic: boolean): string {
  const history = caseData.medicalHistory;
  if (/tonsillitis|التهاب لوز/i.test(history)) {
    return isArabic
      ? 'آه، رحت دكتور ومستشفى قبل كده لالتهاب اللوز.'
      : 'Yes, I saw doctors and went to hospital for tonsillitis before.';
  }
  if (/denies|never|no prior/i.test(history.toLowerCase())) {
    return isArabic ? 'لا، مروحتش دكتور قبل كده.' : 'No, I have not seen a doctor before for this.';
  }
  return isArabic ? 'آه، رحت دكتور قبل كده.' : 'Yes, I have seen a doctor before.';
}

function patientResidencePhrase(caseData: Case, isArabic: boolean): string {
  const social = caseData.socialHistory;
  if (isArabic) {
    if (/shobra|شبرا/i.test(social)) return 'من شبرا الخيمة.';
    const fromMatch = social.match(/from\s+([^,]+)/i);
    if (fromMatch) return `من ${fromMatch[1].trim()}.`;
    return 'من القاهرة.';
  }
  const fromMatch = social.match(/from\s+([^,]+)/i);
  return fromMatch ? `I am from ${fromMatch[1].trim()}.` : social.split('.')[0].trim();
}

function asksWellbeing(text: string): boolean {
  return /how are you|how r u|what'?s up|عامل\s*(إيه|ايه|أي|eh|eih)?|عاملة\s*(إيه|ايه|أي|eh|eih)?|إزيك|ازيك|إزي|ازي|كيف حال|حالك|عامل إيه|عاملة إيه|إيه الأخبار|ايه الاخبار|ايه الأخبار|الأخبار|أخبارك|اخبارك|إيه أخبارك|ايه اخبارك|إيه الحال|ايه الحال|إنت عامل|انت عامل|إنتي عاملة|انتي عاملة|عامله\s*ايه|عامله\s*إيه/i.test(
    text,
  );
}

function asksNationality(text: string): boolean {
  return /nationalit|egyptian|مصري|جنسيت|بلدك|منين|من فين|where.*from|which countr|عربي أم/i.test(
    text,
  );
}

function asksMaritalStatus(text: string): boolean {
  return /marri|married|single|متجوز|متزوج|متجوزة|اعزب|عانس|جواز|زوجت|زوج\b/i.test(text);
}

function asksGender(text: string): boolean {
  return /\b(male|female|gender)\b|ذكر|أنثى|ولد|بنت/i.test(text);
}

type PatientQuestionIntent =
  | 'greeting'
  | 'empathy'
  | 'symptoms'
  | 'name'
  | 'age'
  | 'residence'
  | 'nationality'
  | 'marital'
  | 'gender'
  | 'priorDoctor'
  | 'wellbeing'
  | 'allergy'
  | 'medication'
  | 'familyHistory';

/** Split merged phrases (STT or typed) into separate questions when possible. */
function messageQuestionParts(message: string): string[] {
  const trimmed = message.trim();
  const punctParts = trimmed
    .split(/[؟?،,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  if (punctParts.length > 1) return punctParts;

  const inlineMarkers = [
    /\s+(?=اسمك\s*(?:إ?يه|ايه|eh)\b)/i,
    /\s+(?=اسم\s*حضرتك)/i,
    /\s+(?=what\s+is\s+your\s+name)/i,
    /\s+(?=عندك\s*(?:كم|كام)\s*سنة)/i,
    /\s+(?=عندك\s*(?:كم|كام)\s*سن)/i,
    /\s+(?=عمرك\s*(?:كم|كام)?)/i,
    /\s+(?=how\s*old\b)/i,
    /\s+(?=ساكن(?:ة)?\s*فين)/i,
    /\s+(?=عايش(?:ة)?\s*فين)/i,
    /\s+(?=where\s+do\s+you\s+live)/i,
    /\s+(?=إزيك|ازيك|عامل(?:ة)?\s*(?:إيه|ايه|أي|eh|eih)|ايه\s*الأخبار|إيه\s*الأخبار)/i,
    /\s+(?=how\s+are\s+you)/i,
    /\s+(?=بتشتكي|تشتكي|شكواك|شكواكي)/i,
  ];

  let inlineParts = [trimmed];
  for (const marker of inlineMarkers) {
    const next: string[] = [];
    for (const part of inlineParts) {
      const split = part
        .split(marker)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
      next.push(...(split.length > 1 ? split : [part]));
    }
    inlineParts = next;
  }
  if (inlineParts.length > 1) return inlineParts;

  const tailPatterns = [
    /(?:اسمك\s*إ?يه|اسمك\s*ايه|اسم حضرتك|what is your name)\s*$/i,
    /(?:عندك\s*(?:كم|كام)\s*سنة|عمرك\s*(?:كم|كام)|how\s*old)\s*$/i,
    /(?:ساكن فين|ساكنة فين|عايش فين|where do you live)\s*$/i,
    /(?:روحت.*دكتور|زرت.*دكتور|seen a doctor)\s*$/i,
    /(?:إيه الأخبار|ايه الاخبار|إيه أخبارك|ايه اخبارك|إزيك|ازيك|عامل إيه|how are you)\s*$/i,
  ];

  for (const pattern of tailPatterns) {
    const match = trimmed.match(pattern);
    if (match?.index !== undefined && match.index > 0) {
      const tail = trimmed.slice(match.index).trim();
      const head = trimmed.slice(0, match.index).trim();
      const parts = [head, tail].filter((p) => p.length > 1);
      if (parts.length > 1) return parts;
    }
  }

  return [trimmed];
}

function intentForQuestionPart(part: string): PatientQuestionIntent | null {
  if (isEmpathyOrBlessing(part)) return 'empathy';
  if (asksAboutSymptoms(part)) return 'symptoms';
  if (asksName(part)) return 'name';
  if (asksAge(part)) return 'age';
  if (asksResidence(part)) return 'residence';
  if (asksPriorDoctorVisit(part)) return 'priorDoctor';
  if (asksNationality(part)) return 'nationality';
  if (asksMaritalStatus(part)) return 'marital';
  if (asksGender(part)) return 'gender';
  if (asksWellbeing(part)) return 'wellbeing';
  if (isGreetingOnly(part) || isDoctorIntroduction(part)) return 'greeting';
  return null;
}

function resolvePatientQuestionIntents(message: string): PatientQuestionIntent[] {
  const parts = messageQuestionParts(message);
  const intents: PatientQuestionIntent[] = [];
  const seen = new Set<PatientQuestionIntent>();
  for (const part of parts) {
    const intent = intentForQuestionPart(part);
    if (intent && !seen.has(intent)) {
      seen.add(intent);
      intents.push(intent);
    }
  }

  // Catch intents still present in the full message when splitting merges phrases
  // like "اسمك ايه عامل ايه".
  const detectors: Array<[PatientQuestionIntent, (text: string) => boolean]> = [
    ['name', asksName],
    ['age', asksAge],
    ['residence', asksResidence],
    ['wellbeing', asksWellbeing],
    ['priorDoctor', asksPriorDoctorVisit],
    ['nationality', asksNationality],
    ['marital', asksMaritalStatus],
    ['gender', asksGender],
  ];
  for (const [intent, detect] of detectors) {
    if (!seen.has(intent) && detect(message)) {
      seen.add(intent);
      intents.push(intent);
    }
  }

  if (intents.length === 0) {
    const fallback = intentForQuestionPart(message);
    if (fallback) intents.push(fallback);
  }
  return intents;
}

function resolvePrimaryPatientQuestionIntent(message: string): PatientQuestionIntent | null {
  const intents = resolvePatientQuestionIntents(message);
  return intents.length > 0 ? intents[intents.length - 1] : null;
}

function asksFamilyHistory(text: string): boolean {
  return /(family history|family.*(history|disease|problem)|تاريخ.*(عائلي|عيلة)|العيلة|عيلتك|أهل.*(مرض|زي|نفس)|history of.*family)/i.test(
    text,
  );
}

function deterministicReplyForIntent(
  caseData: Case,
  intent: PatientQuestionIntent,
  isArabic: boolean,
  voiceTurn = true,
): string | null {
  const name = caseData.patientName;
  const complaint = voiceTurn
    ? patientComplaintPhrase(caseData, isArabic)
    : patientRichComplaint(caseData, isArabic);

  switch (intent) {
    case 'greeting':
      return voiceTurn
        ? isArabic
          ? 'أهلاً دكتور.'
          : 'Hello doctor.'
        : patientOpeningReply(caseData, isArabic);
    case 'empathy':
      return patientEmpathyReply(caseData, isArabic);
    case 'wellbeing':
      return patientWellbeingReply(caseData, isArabic, voiceTurn);
    case 'age':
      return isArabic
        ? `عندي ${caseData.patientAge} سنة.`
        : `I am ${caseData.patientAge} years old.`;
    case 'name':
      return isArabic ? `اسمي ${patientNameInLang(caseData, true)}.` : `My name is ${name}.`;
    case 'nationality': {
      const nat = caseData.patientNationality;
      if (isArabic) return /egypt/i.test(nat) ? 'مصري.' : `أنا ${nat}.`;
      return `I am ${nat}.`;
    }
    case 'marital': {
      const social = caseData.socialHistory.toLowerCase();
      const married = /married|wife|husband|زوج|متجوز/i.test(social);
      return isArabic
        ? married
          ? 'آه، متجوز.'
          : 'لا، مش متجوز.'
        : married
          ? 'Yes, I am married.'
          : 'No, I am not married.';
    }
    case 'gender': {
      const g = caseData.patientGender.toLowerCase();
      return isArabic ? (g.startsWith('m') ? 'ذكر.' : 'أنثى.') : caseData.patientGender;
    }
    case 'priorDoctor':
      return patientPriorDoctorPhrase(caseData, isArabic);
    case 'residence':
      return patientResidencePhrase(caseData, isArabic);
    case 'symptoms':
      return complaint;
    default:
      return null;
  }
}

function deterministicReplyForIntents(
  caseData: Case,
  intents: PatientQuestionIntent[],
  isArabic: boolean,
  voiceTurn = true,
): string | null {
  if (intents.length === 0) return null;
  if (intents.length === 1) {
    return deterministicReplyForIntent(caseData, intents[0], isArabic, voiceTurn);
  }

  const replies = intents
    .map((intent) => deterministicReplyForIntent(caseData, intent, isArabic, voiceTurn))
    .filter((reply): reply is string => !!reply?.trim());

  if (replies.length === 0) return null;
  if (replies.length === 1) return replies[0];

  if (isArabic) {
    return `${replies.map((reply) => reply.replace(/\.\s*$/, '').trim()).join('، ')}.`;
  }
  return replies.join(' ');
}

function sanitizePatientResponse(
  caseData: Case,
  userMessage: string,
  response: string,
  language: Language,
  voiceTurn = false,
): string {
  const isArabic = resolvePatientLanguage(language, userMessage);
  const trimmed = response.trim();
  if (!trimmed) return trimmed;

  if (voiceTurn) {
    let text = enforcePatientLanguage(truncatePatientAnswer(trimmed, 2), isArabic);
    if (caseData.patientName && text.includes(caseData.patientName)) {
      text = text.replaceAll(caseData.patientName, patientNameInLang(caseData, true));
    }
    return toEgyptianColloquial(text);
  }

  let text = enforcePatientLanguage(truncatePatientAnswer(trimmed, 5), isArabic);
  if (caseData.patientName && text.includes(caseData.patientName)) {
    text = text.replaceAll(caseData.patientName, patientNameInLang(caseData, true));
  }

  const intent = resolvePrimaryPatientQuestionIntent(userMessage);
  if (
    (intent === 'greeting' || isGreetingOnly(userMessage)) &&
    !asksAboutSymptoms(userMessage)
  ) {
    const complaintSnippet = caseData.chiefComplaint.toLowerCase().slice(0, 24);
    const responseLower = text.toLowerCase();
    if (complaintSnippet.length > 8 && responseLower.includes(complaintSnippet.slice(0, 12))) {
      return toEgyptianColloquial(patientOpeningReply(caseData, isArabic));
    }
  }

  return toEgyptianColloquial(text);
}

function getDeterministicPatientResponse(
  caseData: Case,
  userMessage: string,
  language: Language,
  history: { role: string; content: string }[] = [],
): string | null {
  const isArabic = resolvePatientLanguage(language, userMessage);
  const text = userMessage.trim().toLowerCase();
  const intents = resolvePatientQuestionIntents(userMessage);

  if (intents.length > 0) {
    const intentReply = deterministicReplyForIntents(caseData, intents, isArabic, true);
    if (intentReply) return intentReply;
  }

  if (isEmpathyOrBlessing(userMessage)) {
    return patientEmpathyReply(caseData, isArabic);
  }

  if (/allerg|حساس|حساسية/i.test(text)) {
    return isArabic ? 'لا، مفيش حساسية عندي.' : 'No, I have no known drug allergies.';
  }

  if (/medic|drug|tablet|دوا|أدوية|ادوية/i.test(text)) {
    return isArabic ? 'مش باخد أدوية بانتظام دلوقتي.' : 'I am not on regular medications currently.';
  }

  if (asksFamilyHistory(text)) {
    if (isArabic) {
      if (/hypertension|high blood pressure|ضغط/i.test(caseData.familyHistory)) {
        return 'ماما عندها ضغط.';
      }
      if (/no family|no similar|none/i.test(caseData.familyHistory.toLowerCase())) {
        return 'مفيش حد في العيلة عنده نفس المشكلة.';
      }
      return 'مفيش تاريخ مرضي مهم في العيلة.';
    }
    return `${caseData.familyHistory.split('.')[0].trim()}.`;
  }

  if (asksAboutSymptoms(text)) {
    return patientRichComplaint(caseData, isArabic);
  }

  return null;
}

function mockPatientResponse(
  caseData: Case,
  userMessage: string,
  language: Language,
  history: { role: string; content: string }[] = [],
): string {
  const isArabic = resolvePatientLanguage(language, userMessage);
  const studentTurn = history.filter((m) => m.role === 'STUDENT').length;

  if (isEmpathyOrBlessing(userMessage)) {
    return patientEmpathyReply(caseData, isArabic);
  }

  if (isGreetingOnly(userMessage) || isDoctorIntroduction(userMessage)) {
    if (studentTurn === 0) return patientOpeningReply(caseData, isArabic);
    return isArabic ? 'أهلاً يا دكتور.' : 'Hello doctor.';
  }

  const intent = resolvePrimaryPatientQuestionIntent(userMessage);

  if (intent === 'wellbeing') {
    return patientWellbeingReply(caseData, isArabic, false);
  }
  if (intent === 'symptoms' || asksAboutSymptoms(userMessage)) {
    return patientRichComplaint(caseData, isArabic);
  }
  if (intent === 'name') {
    return isArabic
      ? `اسمي ${patientNameInLang(caseData, true)}.`
      : `My name is ${caseData.patientName}.`;
  }

  const deterministic = getDeterministicPatientResponse(caseData, userMessage, language, history);
  if (deterministic !== null) return deterministic;

  if (isVagueStudentMessage(userMessage)) {
    return isArabic ? 'مش فاهم قصدك يا دكتور، ممكن توضّح سؤالك؟' : 'Could you clarify your question, doctor?';
  }

  const fallbacks = isArabic
    ? [
        'ممكن توضّح سؤالك أكتر يا دكتور؟',
        'مش فاهم قصدك، ممكن تسأل بطريقة أوضح؟',
        'أنا هنا — اسألني اللي محتاج تعرفه.',
      ]
    : [
        'Could you clarify your question?',
        'I am not sure what you mean — please ask more specifically.',
        'I am here — please ask what you need to know.',
      ];

  return fallbacks[studentTurn % fallbacks.length];
}

function buildZeroParticipationEvaluation(
  caseData: Case,
  messages: SessionMessage[],
  lang: 'AR' | 'EN' = 'EN'
): EvaluationResult {
  const caseTitle = lang === 'AR' ? caseData.titleAr || caseData.titleEn : caseData.titleEn;
  const reportTitle = pickLang('OSCE Evaluation Report', 'تقرير تقييم OSCE', lang);
  const perfSummary = pickLang('Performance Summary', 'ملخص الأداء', lang);
  const commLabel = pickLang('Communication', 'التواصل', lang);
  const histLabel = pickLang('History Taking', 'أخذ التاريخ', lang);
  const reasonLabel = pickLang('Clinical Reasoning', 'التفكير السريري', lang);
  const orgLabel = pickLang('Organization', 'التنظيم', lang);
  const closeLabel = pickLang('Closing', 'الختام', lang);
  const overallLabel = pickLang('Overall Score', 'الدرجة الإجمالية', lang);
  const caseLabel = pickLang('Case', 'الحالة', lang);
  const noAttempt = pickLang(
    'No attempt: the station was ended without any interaction with the patient or examiner.',
    'لا توجد محاولة: تم إنهاء المحطة دون أي تفاعل مع المريض أو الممتحن.',
    lang
  );

  return {
    totalScore: 0,
    communicationScore: 0,
    historyTakingScore: 0,
    clinicalReasonScore: 0,
    organizationScore: 0,
    closingScore: 0,
    strengths: pickLang(
      'None recorded — no part of the station was attempted.',
      'لا يوجد — لم تتم محاولة أي جزء من المحطة.',
      lang
    ),
    weaknesses: noAttempt,
    missedQuestions: pickLang(
      'The entire station was missed: history, examination, diagnosis, and management were not attempted.',
      'فاتت المحطة بالكامل: لم تتم محاولة التاريخ أو الفحص أو التشخيص أو الإدارة.',
      lang
    ),
    clinicalErrors: pickLang(
      'Not applicable — no clinical actions were taken.',
      'لا ينطبق — لم تُتخذ أي إجراءات سريرية.',
      lang
    ),
    recommendations: pickLang(
      'Attempt the station: introduce yourself, take a focused history, perform the examination, then give a diagnosis and management plan.',
      'حاول إكمال المحطة: قدّم نفسك، خذ تاريخاً مركزاً، أجرِ الفحص، ثم قدّم التشخيص وخطة الإدارة.',
      lang
    ),
    idealApproach: pickLang(
      `Introduce yourself, confirm identity, explore ${caseData.chiefComplaint} using SOCRATES with exertional symptoms, ask about rheumatic fever and penicillin prophylaxis, complete examination with murmur description, then state ${caseData.finalDiagnosis} with echo referral and management plan.`,
      `قدّم نفسك، تأكد من الهوية، استكشف ${caseData.chiefComplaint} بـ SOCRATES مع أعراض المجهود، اسأل عن الحمى الروماتيزمية والبروفيلاكس بالبنسلين، أكمل الفحص مع وصف الـ murmur، ثم اذكر ${caseData.finalDiagnosis} مع إحالة echo وخطة إدارة.`,
      lang
    ),
    fullReport: `## ${reportTitle}\n\n**${caseLabel}:** ${caseTitle}\n**${overallLabel}:** 0/100\n\n> ${noAttempt}\n\n### ${perfSummary}\n- ${commLabel}: 0/100\n- ${histLabel}: 0/100\n- ${reasonLabel}: 0/100\n- ${orgLabel}: 0/100\n- ${closeLabel}: 0/100`,
  };
}

function mockExaminerEvaluation(
  caseData: Case,
  messages: SessionMessage[],
  lang: 'AR' | 'EN' = 'EN',
  context: EvaluationSessionContext = {}
): EvaluationResult {
  const studentMessages = messages.filter((m) => m.role === 'STUDENT');
  const studentText = studentMessages.map((m) => m.content).join(' ').toLowerCase();
  const studentWordCount = studentText.split(/\s+/).filter((w) => w.length > 1).length;
  const completedManeuversEarly = context.completedManeuvers ?? [];

  // No participation at all → a genuine zero. The student did nothing, so every
  // dimension must score 0 rather than inheriting the base constants below.
  if (studentWordCount === 0 && completedManeuversEarly.length === 0) {
    return buildZeroParticipationEvaluation(caseData, messages, lang);
  }

  const historyMsgCount = studentMessages.filter(
    (m) => m.stage === 'history' || m.stage === 'history:examiner'
  ).length;
  const examMsgCount = studentMessages.filter((m) => m.stage.startsWith('examination:')).length;
  const diagnosisMsgCount = studentMessages.filter((m) => m.stage === 'diagnosis').length;
  const stagesCovered = new Set(studentMessages.map((m) => m.stage)).size;
  const completedManeuvers = context.completedManeuvers ?? [];
  const checklistHits = [
    hasPattern(studentText, /\b(introduc|my name|hello|good (morning|afternoon|evening)|اسم|أنا د|مرحب)/i),
    hasPattern(studentText, /\b(pain|breath|dyspnea|chest|symptom|complaint|ألم|ضيق|تنفس|عرض)/i),
    hasPattern(studentText, /\b(rheumatic|fever|penicillin|prophylaxis|حمى)/i),
    hasPattern(studentText, /\b(medication|medicine|drug|دواء|علاج)/i),
    hasPattern(studentText, /\b(family|عيل|أهل)/i),
    hasPattern(studentText, /\b(syncope|palpitation|orthopnea|إغماء|خفقان)/i),
    hasPattern(studentText, /\b(exertion|exercise|sport|football|مجهود|رياض)/i),
    hasPattern(studentText, /\b(murmur|apex|scar|auscult|palpat|percuss|inspect|صمام|ذرو|ندبة)/i),
  ].filter(Boolean).length;

  const historyText = studentMessages
    .filter((m) => m.stage === 'history' || m.stage === 'history:examiner')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();
  const examText = studentMessages
    .filter((m) => m.stage.startsWith('examination:'))
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();
  const diagnosisText = studentMessages
    .filter((m) => m.stage === 'diagnosis')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();

  const askedIntroduction = hasPattern(studentText, /\b(introduc|my name|hello|good (morning|afternoon|evening)|اسم|أنا د|مرحب)/i);
  const askedComplaint = hasPattern(historyText, /\b(pain|breath|dyspnea|chest|symptom|complaint|when|how long|duration|ألم|ضيق|تنفس|عرض)/i);
  const askedRheumatic = hasPattern(historyText, /\b(rheumatic|fever|rheumatic fever|childhood illness|penicillin|prophylaxis|حمى)/i);
  const askedMeds = hasPattern(historyText, /\b(medication|medicine|drug|compliance|prophylaxis|دواء|علاج)/i);
  const askedFamily = hasPattern(historyText, /\b(family|hereditary|genetic|عيل|أهل|family history)/i);
  const askedRedFlags = hasPattern(historyText, /\b(syncope|palpitation|orthopnea|pnd|night sweat|weight|fever|red flag|إغماء|خفقان)/i);
  const askedExertional = hasPattern(historyText, /\b(exertion|exercise|effort|sport|football|activity|مجهود|رياض)/i);
  const describedExam = hasPattern(examText, /\b(murmur|apex|scar|auscult|palpat|percuss|inspect|thrill|heave|صمام|ذرو|ندبة)/i);
  const correctDiagnosis = hasPattern(
    diagnosisText,
    /\b(aortic stenosis|mitral regurg|rheumatic|as\s*\+\s*mr|combined.*stenosis|تضيق.*أورط|قصور.*mitral|rheumatic heart)/i
  );
  const partialDiagnosis = !correctDiagnosis && hasPattern(diagnosisText, /\b(heart|cardiac|valve|murmur|valvular|قلب|صمام)/i);
  const gaveManagement = hasPattern(diagnosisText, /\b(manage|treat|refer|echo|echocardi|follow.?up|penicillin|surgery|intervention|إدارة|علاج|متابعة)/i);

  let communicationScore =
    20 +
    Math.min(25, historyMsgCount * 6) +
    Math.min(20, Math.floor(studentWordCount / 8)) +
    Math.min(15, stagesCovered * 4);
  if (askedIntroduction) communicationScore += 12;
  communicationScore = Math.min(100, communicationScore);

  let historyTakingScore =
    15 +
    Math.min(20, historyMsgCount * 5) +
    checklistHits * 6;
  if (askedComplaint) historyTakingScore += 12;
  if (askedExertional) historyTakingScore += 8;
  if (askedRheumatic) historyTakingScore += 12;
  if (askedMeds) historyTakingScore += 8;
  if (askedFamily) historyTakingScore += 6;
  if (askedRedFlags) historyTakingScore += 10;
  historyTakingScore = Math.min(100, historyTakingScore);

  let clinicalReasonScore =
    10 +
    completedManeuvers.length * 12 +
    Math.min(20, examMsgCount * 8) +
    Math.min(15, diagnosisMsgCount * 10);
  if (describedExam) clinicalReasonScore += 15;
  if (correctDiagnosis) clinicalReasonScore += 35;
  else if (partialDiagnosis) clinicalReasonScore += 16;
  if (gaveManagement) clinicalReasonScore += 12;
  clinicalReasonScore = Math.min(100, clinicalReasonScore);

  const organizationScore = Math.min(
    100,
    18 +
      stagesCovered * 10 +
      Math.min(20, historyMsgCount * 4) +
      (askedIntroduction ? 12 : 0) +
      (askedComplaint ? 10 : 0) +
      completedManeuvers.length * 6
  );
  const closingScore = Math.min(
    100,
    12 +
      Math.min(25, diagnosisMsgCount * 12) +
      Math.min(15, Math.floor(diagnosisText.length / 40)) +
      (correctDiagnosis ? 40 : partialDiagnosis ? 18 : 0) +
      (gaveManagement ? 18 : 0)
  );

  const totalScore = Math.round(
    communicationScore * 0.2 +
      historyTakingScore * 0.3 +
      clinicalReasonScore * 0.25 +
      organizationScore * 0.15 +
      closingScore * 0.1
  );

  const strengths: string[] = [];
  if (askedIntroduction) {
    strengths.push(
      pickLang('Opened with a professional introduction.', 'بدأ بمقدمة مهنية واضحة.', lang)
    );
  }
  if (askedComplaint) {
    strengths.push(
      pickLang('Explored the presenting complaint.', 'استكشف الشكوى الرئيسية.', lang)
    );
  }
  if (askedRheumatic) {
    strengths.push(
      pickLang(
        'Asked about rheumatic fever history — key for this case.',
        'سأل عن تاريخ الحمى الروماتيزمية — مهم جداً في الحالة دي.',
        lang
      )
    );
  }
  if (askedExertional) {
    strengths.push(
      pickLang(
        'Explored exertional symptoms appropriately.',
        'استكشف أعراض المجهود بشكل مناسب.',
        lang
      )
    );
  }
  if (describedExam) {
    strengths.push(
      pickLang(
        'Provided examination findings during the viva.',
        'قدّم ملاحظات فحص سريري أثناء الـ viva.',
        lang
      )
    );
  }
  if (correctDiagnosis) {
    strengths.push(
      pickLang(
        `Correctly identified the diagnosis (${caseData.finalDiagnosis}).`,
        `حدّد التشخيص بشكل صحيح (${caseData.finalDiagnosis}).`,
        lang
      )
    );
  }
  if (strengths.length === 0) {
    strengths.push(
      pickLang(
        'Engaged with the simulated patient and attempted the station.',
        'تفاعل مع المريض المحاكى وحاول إكمال المحطة.',
        lang
      )
    );
  }

  const weaknesses: string[] = [];
  if (!askedIntroduction) {
    weaknesses.push(
      pickLang(
        'Did not clearly introduce themselves or establish rapport.',
        'لم يقدّم نفسه بوضوح أو يبني rapport مع المريض.',
        lang
      )
    );
  }
  if (!askedRheumatic) {
    weaknesses.push(
      pickLang(
        'Did not explore history of rheumatic fever — critical for this case.',
        'لم يسأل عن تاريخ الحمى الروماتيزمية — نقطة حاسمة في الحالة دي.',
        lang
      )
    );
  }
  if (!askedMeds) {
    weaknesses.push(
      pickLang(
        'Insufficient exploration of medication history / penicillin prophylaxis.',
        'استكشاف غير كافٍ لتاريخ الأدوية / البروفيلاكس بالبنسلين.',
        lang
      )
    );
  }
  if (!askedRedFlags) {
    weaknesses.push(
      pickLang(
        'Missed important red-flag screening questions.',
        'فاتته أسئلة مهمّة عن red flags.',
        lang
      )
    );
  }
  if (!describedExam) {
    weaknesses.push(
      pickLang(
        'Limited or no structured examination findings documented.',
        'ملاحظات الفحص السريري محدودة أو غير منظمة.',
        lang
      )
    );
  }
  if (!correctDiagnosis && !partialDiagnosis) {
    weaknesses.push(
      pickLang(
        'Final diagnosis was absent or not clinically supported.',
        'التشخيص النهائي غائب أو غير مدعوم سريرياً.',
        lang
      )
    );
  }
  if (weaknesses.length === 0) {
    weaknesses.push(
      pickLang(
        'Minor refinements needed in systematic coverage and closing summary.',
        'محتاج تحسينات بسيطة في التغطية المنهجية والملخص الختامي.',
        lang
      )
    );
  }

  const missed: string[] = [];
  if (!askedRheumatic) {
    missed.push(
      pickLang(
        'History of rheumatic fever and penicillin prophylaxis compliance',
        'تاريخ الحمى الروماتيزمية والالتزام بالبروفيلاكس بالبنسلين',
        lang
      )
    );
  }
  if (!askedExertional) {
    missed.push(
      pickLang(
        'Exertional dyspnea progression and functional limitation',
        'تطور ضيق النفس مع المجهود والقصور الوظيفي',
        lang
      )
    );
  }
  if (!askedRedFlags) {
    missed.push(
      pickLang('Syncope, palpitations, orthopnea/PND', 'الإغماء، الخفقان، orthopnea/PND', lang)
    );
  }
  if (!askedFamily) {
    missed.push(
      pickLang('Relevant family cardiac history', 'التاريخ العائلي القلبي relevant', lang)
    );
  }
  if (missed.length === 0) {
    missed.push(
      pickLang(
        'Consider deeper exploration of differential diagnoses and investigation planning.',
        'فكّر في استكشاف أعمق للتشخيصات التفاضلية وخطة التحاليل.',
        lang
      )
    );
  }

  const errors: string[] = [];
  if (!correctDiagnosis && diagnosisText.length > 0) {
    errors.push(
      pickLang(
        `Submitted diagnosis did not match the expected: ${caseData.finalDiagnosis}.`,
        `التشخيص المقدّم لا يطابق المتوقع: ${caseData.finalDiagnosis}.`,
        lang
      )
    );
  }
  if (!askedMeds && /penicillin|prophylaxis/i.test(caseData.medicationHistory)) {
    errors.push(
      pickLang(
        'Did not assess penicillin prophylaxis adherence despite it being relevant to the case.',
        'لم يقيّم الالتزام بالبروفيلاكس بالبنسلين رغم أهميته في الحالة.',
        lang
      )
    );
  }
  if (errors.length === 0) {
    errors.push(
      pickLang(
        'No major clinical safety errors identified from the transcript.',
        'لم تُرصد أخطاء سريرية خطيرة في المحادثة.',
        lang
      )
    );
  }

  const caseTitle = lang === 'AR' ? caseData.titleAr || caseData.titleEn : caseData.titleEn;
  const reportTitle = pickLang('OSCE Evaluation Report', 'تقرير تقييم OSCE', lang);
  const perfSummary = pickLang('Performance Summary', 'ملخص الأداء', lang);
  const strengthsTitle = pickLang('Strengths', 'نقاط القوة', lang);
  const improveTitle = pickLang('Areas for Improvement', 'مجالات التحسين', lang);
  const missedTitle = pickLang('Missed Key Questions', 'أسئلة مهمة فاتت', lang);
  const errorsTitle = pickLang('Clinical Errors', 'أخطاء سريرية', lang);
  const commLabel = pickLang('Communication', 'التواصل', lang);
  const histLabel = pickLang('History Taking', 'أخذ التاريخ', lang);
  const reasonLabel = pickLang('Clinical Reasoning', 'التفكير السريري', lang);
  const orgLabel = pickLang('Organization', 'التنظيم', lang);
  const closeLabel = pickLang('Closing', 'الختام', lang);
  const studentMsgsLabel = pickLang('Student messages analyzed', 'رسائل الطالب المحلّلة', lang);
  const overallLabel = pickLang('Overall Score', 'الدرجة الإجمالية', lang);
  const caseLabel = pickLang('Case', 'الحالة', lang);
  const reportFooter = pickLang(
    `Report generated from full session transcript (${messages.length} messages).`,
    `التقرير مُولَّد من محادثة الجلسة الكاملة (${messages.length} رسالة).`,
    lang
  );

  return {
    totalScore,
    communicationScore,
    historyTakingScore,
    clinicalReasonScore,
    organizationScore,
    closingScore,
    strengths: strengths.join(lang === 'AR' ? ' ' : ' '),
    weaknesses: weaknesses.join(lang === 'AR' ? ' ' : ' '),
    missedQuestions: missed.join(lang === 'AR' ? '؛ ' : '; '),
    clinicalErrors: errors.join(lang === 'AR' ? ' ' : ' '),
    recommendations: pickLang(
      'Review systematic cardiac history (SOCRATES + red flags), rheumatic heart disease features, and structured OSCE closing with diagnosis and management plan.',
      'راجع أخذ التاريخ القلبي المنهجي (SOCRATES + red flags)، وسمات مرض القلب الروماتيزمي، وختام OSCE منظم بالتشخيص وخطة الإدارة.',
      lang
    ),
    idealApproach: pickLang(
      `Introduce yourself, confirm identity, explore ${caseData.chiefComplaint} using SOCRATES with exertional symptoms, ask about rheumatic fever and penicillin prophylaxis, complete examination with murmur description, then state ${caseData.finalDiagnosis} with echo referral and management plan.`,
      `قدّم نفسك، تأكد من الهوية، استكشف ${caseData.chiefComplaint} بـ SOCRATES مع أعراض المجهود، اسأل عن الحمى الروماتيزمية والبروفيلاكس بالبنسلين، أكمل الفحص مع وصف الـ murmur، ثم اذكر ${caseData.finalDiagnosis} مع إحالة echo وخطة إدارة.`,
      lang
    ),
    fullReport: `## ${reportTitle}\n\n**${caseLabel}:** ${caseTitle}\n**${studentMsgsLabel}:** ${studentMessages.length}\n**${overallLabel}:** ${totalScore}/100\n\n### ${perfSummary}\n- ${commLabel}: ${communicationScore}/100\n- ${histLabel}: ${historyTakingScore}/100\n- ${reasonLabel}: ${clinicalReasonScore}/100\n- ${orgLabel}: ${organizationScore}/100\n- ${closeLabel}: ${closingScore}/100\n\n### ${strengthsTitle}\n${strengths.map((s) => `- ${s}`).join('\n')}\n\n### ${improveTitle}\n${weaknesses.map((w) => `- ${w}`).join('\n')}\n\n### ${missedTitle}\n${missed.map((m) => `- ${m}`).join('\n')}\n\n### ${errorsTitle}\n${errors.map((e) => `- ${e}`).join('\n')}\n\n---\n*${reportFooter}*`,
  };
}

export async function getExaminerEvaluation(
  caseData: Case,
  messages: SessionMessage[],
  lang: 'AR' | 'EN' = 'EN',
  context: EvaluationSessionContext = {},
  usageMeta?: Omit<AiUsageMeta, 'feature'>,
): Promise<EvaluationResult> {
  const transcript = buildSessionTranscript(caseData, messages);
  const mockResult = mockExaminerEvaluation(caseData, messages, lang, context);
  const settings = await getAISettings();
  const provider = process.env.AI_PROVIDER || settings.provider;

  if (provider === 'mock' || provider === 'demo') {
    return mockResult;
  }

  const knowledgeContext = await getRoleKnowledgeContext({
    categoryId: caseData.categoryId,
    caseId: caseData.id,
    role: 'examiner',
  });
  const systemPrompt =
    buildExaminerEvaluationPrompt(caseData, knowledgeContext, lang) +
    adminSystemPromptSuffix(settings, lang, 'examiner');
  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content:
        lang === 'AR'
          ? `قيّم جلسة OSCE الكاملة التالية. حلّل كل رسالة STUDENT قبل وضع الدرجات. اكتب كل الحقول النصية بالعربية فقط:\n\n${transcript}`
          : `Evaluate this complete OSCE session. Analyze every STUDENT message before scoring:\n\n${transcript}`,
    },
  ];

  const raw = await callOpenAISafe(
    chatMessages,
    settings.examinerModel,
    0.3,
    4096,
    () => JSON.stringify(mockResult),
    { feature: 'evaluation', userId: usageMeta?.userId, sessionId: usageMeta?.sessionId },
  );

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<EvaluationResult>;
      const normalized = normalizeEvaluation(parsed, mockResult);
      const withContentScores = {
        ...normalized,
        totalScore: mockResult.totalScore,
        communicationScore: mockResult.communicationScore,
        historyTakingScore: mockResult.historyTakingScore,
        clinicalReasonScore: mockResult.clinicalReasonScore,
        organizationScore: mockResult.organizationScore,
        closingScore: mockResult.closingScore,
      };
      return mergeEvaluationWithLanguage(withContentScores, mockResult, lang);
    }
  } catch {
    // fall through to mock
  }

  return mockResult;
}

export function buildRealtimePatientInstructions(caseData: Case, sessionLanguage: string): string {
  const lang: Language = sessionLanguage === 'EN' ? 'EN' : 'AR';
  if (lang === 'EN') {
    return `You are ${caseData.patientName}, a ${caseData.patientAge}-year-old PATIENT in an OSCE voice call. You are NOT the doctor. You NEVER interview or examine the doctor.

Background (only if asked about that specific topic):
- Chief complaint: ${caseData.chiefComplaint}
- History: ${caseData.medicalHistory}

STRICT RULES:
1. Wait for the doctor's question, then answer in ONE short sentence (two max).
2. NEVER ask the doctor any question. Forbidden: "can you tell me", "does it increase when", "what happens when you", "do you have".
3. Greeting or "how are you" ONLY → "Not great, doctor." or "Hello doctor." — NO symptoms, NO history.
4. Do not volunteer symptoms, age, name, or complaints unless directly asked about that topic.
5. Never reveal the diagnosis (${caseData.finalDiagnosis}).`;
  }

  return `أنت ${caseData.patientName}، مريض/ة مصري/ة عمرك ${caseData.patientAge} سنة. أنت المريض فقط — مش الدكتور ومش الممتحن ومش بتعمل مقابلة طبية.

الخلفية (ممنوع تذكرها إلا لو الدكتور سأل عن نفس الموضوع بالتحديد):
- الشكوى: ${caseData.chiefComplaint}
- التاريخ: ${caseData.medicalHistory}

قواعد صارمة للمكالمة الصوتية:
1. استنى سؤال الدكتور، وبعدين أجب بجملة واحدة أو اتنين بالعامية المصرية فقط.
2. ممنوع تسأل الدكتور أي سؤال. ممنوع تماماً: "ممكن تحكيلي"، "قولي إيه"، "هل عندك"، "لما تتحرك"، "فهمني أكتر"، "توضح".
3. تحية أو "إزيك" أو "إيه الأخبار" أو "عامل إيه" → رد بس: "مش في أحسن حالي دكتور." أو "أهلاً دكتور." — ممنوع تذكر أعراض أو شكوى أو مدة المرض.
4. ممنوع تتكلم من نفسك أو تعرض حالتك أو تسأل الدكتور عن أعراضه — أنت المريض بس.
5. جاوب على السؤال اللي اتسأل بس — مش أكتر.
6. ممنوع الفصحى والإنجليزي. ممنوع تقول التشخيص (${caseData.finalDiagnosis}).`;
}

function patientActingAsDoctor(text: string): boolean {
  return /ممكن تحكيلي|قولي إيه|قولّي إيه|قولي بالظبط|تحكيلي|هل عندك|عندك كحة|لما تتحرك|لما تتعب|tell me if|can you tell|what happens when|do you have|when you move/i.test(
    text,
  );
}

function stripDoctorQuestionsFromPatient(text: string): string {
  const withoutQuestions = text
    .split(/[؟?]/)
    .map((part) => part.trim())
    .filter((part) => part && !patientActingAsDoctor(part))
    .join('. ')
    .trim();
  return withoutQuestions || text.split(/[؟?]/)[0]?.trim() || text;
}

/** Post-process OpenAI Realtime patient audio transcript using the same rules as text chat. */
export function sanitizeRealtimePatientTranscript(
  caseData: Case,
  studentMessage: string,
  patientTranscript: string,
  sessionLanguage: string,
): string {
  const lang: Language = sessionLanguage === 'EN' ? 'EN' : 'AR';
  const deterministic = getDeterministicPatientResponse(caseData, studentMessage, lang, []);
  if (deterministic !== null) {
    return deterministic;
  }

  let text = sanitizePatientResponse(caseData, studentMessage, patientTranscript, lang, true);

  if (patientActingAsDoctor(text)) {
    if (asksAboutSymptoms(studentMessage)) {
      text = stripDoctorQuestionsFromPatient(text);
    } else {
      text = lang === 'AR' ? 'مش فاهم قصدك دكتور.' : "I don't understand, doctor.";
    }
  }

  if (!asksAboutSymptoms(studentMessage) && !asksName(studentMessage) && !asksAge(studentMessage)) {
    const complaintHint = caseData.chiefComplaint.toLowerCase().slice(0, 24);
    const responseLower = text.toLowerCase();
    if (
      complaintHint.length > 8 &&
      responseLower.includes(complaintHint.slice(0, 12)) &&
      !asksWellbeing(studentMessage) &&
      !asksPriorDoctorVisit(studentMessage) &&
      !asksResidence(studentMessage)
    ) {
      text = lang === 'AR' ? 'أهلاً دكتور.' : 'Hello doctor.';
    }
  }

  const trimmed = text.trim();
  if (!trimmed) {
    const retry = getDeterministicPatientResponse(caseData, studentMessage, lang, []);
    if (retry) return retry;
    return lang === 'AR' ? 'مش فاهم، ممكن توضّح سؤالك؟' : 'Could you clarify your question?';
  }
  return trimmed;
}

export async function getPatientResponse(
  caseData: Case,
  history: { role: string; content: string }[],
  userMessage: string,
  language: Language,
  options?: { voiceTurn?: boolean; userId?: string; sessionId?: string },
): Promise<string> {
  const normalizedMessage = normalizeStudentMessage(userMessage, language);
  const lang = effectivePatientLanguage(language, normalizedMessage);
  const voiceTurn = !!options?.voiceTurn;
  const studentTurn = history.filter((m) => m.role === 'STUDENT').length;

  const [customPatientKnowledge, settings] = await Promise.all([
    hasPatientAiKnowledge({
      caseId: caseData.id,
      categoryId: caseData.categoryId,
    }),
    getAISettingsCached(),
  ]);

  // Skip canned social/greeting scripts when admin configured patient AI knowledge.
  if (!customPatientKnowledge) {
    const social = quickSocialPatientReply(caseData, normalizedMessage, lang, history, voiceTurn);
    if (social) {
      return finalizePatientReply(caseData, normalizedMessage, social, lang, history, voiceTurn);
    }
  }

  // Canned deterministic replies ignore Knowledge Base AI personas — skip when admin configured patient knowledge.
  if (!customPatientKnowledge) {
    const deterministic = getDeterministicPatientResponse(caseData, normalizedMessage, lang, history);
    if (deterministic !== null) {
      return finalizePatientReply(caseData, normalizedMessage, deterministic, lang, history, voiceTurn);
    }
  }

  const provider = process.env.AI_PROVIDER || settings.provider;

  if (provider === 'mock' || provider === 'demo') {
    return finalizePatientReply(
      caseData,
      normalizedMessage,
      mockPatientResponse(caseData, normalizedMessage, lang, history),
      lang,
      history,
      voiceTurn,
    );
  }

  const knowledgeContext = await getRoleKnowledgeContext({
    categoryId: caseData.categoryId,
    caseId: caseData.id,
    role: 'patient',
  });
  const promptHistory = chatContextWindow(history, settings.maxContextMessages, voiceTurn);
  const systemPrompt = buildPatientSystemPrompt(
    caseData,
    lang,
    knowledgeContext,
    voiceTurn,
    studentTurn,
  ) + adminSystemPromptSuffix(settings, lang, 'patient');
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...promptHistory.map((m) => ({
      role: (m.role === 'STUDENT' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: normalizedMessage },
  ];

  const voiceModel =
    process.env.OPENAI_VOICE_MODEL ||
    process.env.OPENAI_PATIENT_MODEL ||
    'gpt-4o-mini';
  const activeModel = voiceTurn ? voiceModel : chatPatientModel(settings);
  const maxTokens = voiceTurn
    ? VOICE_PATIENT_MAX_TOKENS
    : Math.min(settings.maxTokens, CHAT_PATIENT_MAX_TOKENS);
  const temperature = voiceTurn ? 0.3 : Math.min(Math.max(settings.temperature, 0.45), 0.65);

  const raw = await callOpenAISafe(
    messages,
    activeModel,
    temperature,
    maxTokens,
    () =>
      voiceTurn
        ? (lang === 'EN' ? 'Sorry, could you clarify?' : 'مش فاهم، ممكن توضّح سؤالك؟')
        : mockPatientResponse(caseData, normalizedMessage, lang, history),
    {
      feature: voiceTurn ? 'realtime' : 'patient_chat',
      userId: options?.userId,
      sessionId: options?.sessionId,
    },
    { timeoutMs: voiceTurn ? VOICE_TIMEOUT_MS : CHAT_TIMEOUT_MS },
  );

  const sanitized = sanitizePatientResponse(
    caseData,
    normalizedMessage,
    raw,
    lang,
    voiceTurn,
  );
  const finalized = finalizePatientReply(
    caseData,
    normalizedMessage,
    sanitized,
    lang,
    history,
    voiceTurn,
  );
  const trimmed = finalized.trim();
  if (!trimmed) {
    return lang === 'AR' ? 'مش فاهم، ممكن توضّح سؤالك؟' : 'Could you clarify your question?';
  }
  return trimmed;
}

export interface VivaAnswerEvaluation {
  advance: boolean;
  feedback: string;
}

const VIVA_EVAL_STOP_WORDS = new Set([
  'what',
  'the',
  'how',
  'does',
  'would',
  'which',
  'that',
  'this',
  'with',
  'from',
  'your',
  'you',
  'are',
  'for',
  'and',
  'why',
  'when',
  'where',
  'about',
  'help',
  'role',
  'purpose',
  'features',
  'clinical',
  'patient',
  'examination',
  'history',
  'after',
  'into',
  'they',
  'their',
  'have',
  'has',
  'been',
  'being',
]);

function vivaQuestionKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !VIVA_EVAL_STOP_WORDS.has(word));
}

function splitModelAnswerPoints(sampleAnswer: string): string[] {
  const structured = sampleAnswer
    .split(/\n+|(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+/m)
    .flatMap((chunk) => chunk.split(/;\s+/))
    .map((point) => point.replace(/^[-*•\s]+/, '').replace(/\*\*/g, '').trim())
    .filter((point) => point.length >= 3)
    .filter((point) => !/:\s*$/.test(point) && !/^(causes|complications|signs|definition)\b/i.test(point));

  if (structured.length >= 2) return structured;

  // Prose lists like "obstructive jaundice, bilharziasis and diabetes mellitus"
  const single = (structured[0] || sampleAnswer).trim();
  const listified = splitProseCauseList(single);
  if (listified.length >= 2) return listified;

  return structured.length > 0 ? structured : [single].filter((p) => p.length >= 3);
}

/** Split comma / "and" lists so one correct cause can earn partial credit. */
function splitProseCauseList(text: string): string[] {
  const cleaned = stripMarkdown(text)
    .replace(/^(?:medical\s+)?causes?(?:\s+of\s+[^:]+)?\s*(?:include|:)\s*/i, '')
    .replace(/[.?!]+$/g, '')
    .trim();
  if (!cleaned || !/,/.test(cleaned)) return [];

  const parts = cleaned
    .split(/\s*,\s*|\s+and\s+|\s+or\s+|\s*\/\s*|\s*&\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
    .filter((part) => !/^(include|including|such as|e\.g\.?|etc)\b/i.test(part));

  return parts.length >= 2 ? parts : [];
}

const GENERIC_MEDICAL_WORDS = new Set([
  'mitral',
  'aortic',
  'tricuspid',
  'pulmonary',
  'ventricular',
  'atrial',
  'cardiac',
  'heart',
  'defect',
  'disease',
  'left',
  'right',
  'thrill',
  'apical',
  'patient',
  'causes',
  'include',
  'the',
  'with',
  'from',
  'and',
  'arteriosus',
]);

const LABEL_TIMING_WORDS = ['systolic', 'diastolic', 'presystolic', 'ejection', 'pansystolic'];
const LABEL_SITE_WORDS = ['parasternal', 'basal', 'epigastric', 'pulmonary', 'tricuspid'];
const LABEL_VOLUME_WORDS = ['minimal', 'earliest', 'mild', 'moderate', 'tense', 'pelvic'];

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').trim();
}

function requiredLabelTerms(label: string): string[] {
  const lower = stripMarkdown(label).toLowerCase();
  const terms: string[] = [];
  for (const word of LABEL_TIMING_WORDS) {
    if (lower.includes(word)) terms.push(word);
  }
  for (const word of LABEL_SITE_WORDS) {
    if (lower.includes(word)) terms.push(word);
  }
  for (const word of LABEL_VOLUME_WORDS) {
    if (lower.includes(word)) terms.push(word);
  }
  if (lower.includes('left') && lower.includes('parasternal')) terms.push('left');
  if (terms.length === 0 && /\bapical\b/.test(lower)) terms.push('apical');
  return [...new Set(terms)];
}

function requiredValueTerms(value: string): string[] {
  const cleaned = stripMarkdown(value).toLowerCase();
  const abbreviation = cleaned.match(/\(([a-z]{2,8})\)/);
  if (abbreviation) return [abbreviation[1]];

  const words = cleaned
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !GENERIC_MEDICAL_WORDS.has(word));
  return words;
}

function colonStructuredPointIsCovered(studentLower: string, point: string): boolean | null {
  const cleaned = stripMarkdown(point);
  const parts = cleaned.split(/:\s*/);
  if (parts.length < 2) return null;

  const label = parts[0];
  const value = parts.slice(1).join(':');
  const labelTerms = requiredLabelTerms(label);
  const valueTerms = requiredValueTerms(value);

  if (labelTerms.length > 0 && !labelTerms.every((term) => studentLower.includes(term))) {
    return false;
  }

  const valuePhrase = value.toLowerCase().replace(/[.!?]/g, '').replace(/\s+/g, ' ').trim();
  if (valuePhrase.length >= 10 && studentLower.includes(valuePhrase)) {
    return true;
  }

  if (valueTerms.length === 0) return false;

  return valueTerms.every((term) => {
    if (term.length <= 5) {
      return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(studentLower);
    }
    return studentLower.includes(term);
  });
}

function pointKeywords(point: string): string[] {
  return point
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !VIVA_EVAL_STOP_WORDS.has(word));
}

function pointIsCovered(studentLower: string, point: string): boolean {
  const colonMatch = colonStructuredPointIsCovered(studentLower, point);
  if (colonMatch !== null) return colonMatch;

  const cleaned = stripMarkdown(point);
  const pointLower = cleaned.toLowerCase();
  const abbreviation = cleaned.match(/\(([A-Za-z]{2,8})\)/);
  if (abbreviation) {
    const abbr = abbreviation[1].toLowerCase();
    if (new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(studentLower)) {
      return true;
    }
    const corePhrase = pointLower
      .replace(/\([^)]*\)/g, '')
      .replace(/[.!?]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (corePhrase.length >= 10 && studentLower.includes(corePhrase)) {
      return true;
    }
    return false;
  }

  const keywords = pointKeywords(point);
  if (keywords.length === 0) return false;
  const hits = keywords.filter((word) => studentLower.includes(word));
  if (keywords.length <= 2) return hits.length >= 1;
  return hits.length / keywords.length >= 0.45;
}

function scoreAnswerAgainstModel(
  studentAnswer: string,
  sampleAnswer: string,
): { coverage: number; matched: string[]; missing: string[] } {
  const points = splitModelAnswerPoints(sampleAnswer);
  if (points.length === 0) {
    return { coverage: 0, matched: [], missing: [] };
  }
  const studentLower = studentAnswer.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const point of points) {
    if (pointIsCovered(studentLower, point)) matched.push(point);
    else missing.push(point);
  }
  return {
    coverage: matched.length / points.length,
    matched,
    missing,
  };
}

function shortPointLabel(point: string): string {
  const cleaned = stripMarkdown(point).replace(/[.]+$/g, '').trim();
  const [label] = cleaned.split(/:\s*/);
  return (label ?? cleaned).slice(0, 90).trim();
}

function buildPartialCreditFeedback(
  matched: string[],
  missing: string[],
  options?: { duplicateAttempt?: boolean },
): string {
  if (missing.length === 0) {
    return 'Correct — you covered all the expected key points.';
  }

  const missingLabels = missing.slice(0, 4).map(shortPointLabel);
  const hintLabel = missingLabels[0];

  if (options?.duplicateAttempt) {
    return missing.length === 1
      ? `Correct so far — you already mentioned that point. One more to go: think about ${hintLabel}.`
      : `Correct so far — you already mentioned that point. Keep going: you still need ${missing.length} more (hint: ${hintLabel}).`;
  }

  const correctLabels = matched.slice(0, 3).map(shortPointLabel);
  const correctPart = correctLabels.length
    ? `Correct — ${correctLabels.join('; ')} is right. `
    : 'Good start — that point is correct. ';

  const missingPart =
    missing.length === 1
      ? `There is still one more to complete the answer — hint: ${hintLabel}.`
      : `The answer is still incomplete (${missing.length} more points). Hint: think about ${hintLabel}.`;

  return `${correctPart}${missingPart}`.trim();
}

function priorCombinedAnswer(combined: string, current: string): string {
  const trimmedCombined = combined.trim();
  const trimmedCurrent = current.trim();
  if (!trimmedCurrent || trimmedCombined === trimmedCurrent) return '';
  if (trimmedCombined.endsWith(trimmedCurrent)) {
    return trimmedCombined.slice(0, trimmedCombined.length - trimmedCurrent.length).replace(/\n+$/, '').trim();
  }
  return trimmedCombined.replace(trimmedCurrent, '').trim();
}

function evaluateHistoryVivaAnswerFromModel(
  studentAnswer: string,
  sampleAnswer: string,
  combinedStudentAnswer?: string,
): VivaAnswerEvaluation {
  const combined = (combinedStudentAnswer ?? studentAnswer).trim();
  const current = studentAnswer.trim();
  const before = priorCombinedAnswer(combined, current);
  const { matched, missing } = scoreAnswerAgainstModel(combined, sampleAnswer);
  const prior = before ? scoreAnswerAgainstModel(before, sampleAnswer) : { matched: [] as string[], missing };
  const duplicateAttempt =
    before.length > 0 &&
    matched.length === prior.matched.length &&
    matched.every((point) => prior.matched.includes(point));

  if (matched.length > 0 && missing.length === 0) {
    return {
      advance: true,
      feedback: 'Correct — you covered all the expected key points.',
    };
  }

  if (matched.length > 0) {
    return {
      advance: false,
      feedback: buildPartialCreditFeedback(matched, missing, { duplicateAttempt }),
    };
  }

  const words = current.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return {
      advance: false,
      feedback:
        'That is quite brief. Give one clear clinical point, then we can build the rest of the answer.',
    };
  }

  // Student said something substantial but it didn't match the model key —
  // encourage and give a soft thematic hint instead of a hard reject.
  const softHint = missing[0] ? shortPointLabel(missing[0]) : '';
  return {
    advance: false,
    feedback: softHint
      ? `Not complete yet — try listing the main points systematically. Hint: one expected area is ${softHint}.`
      : 'Not complete yet — try listing the main clinical points systematically, one by one.',
  };
}

function mockEvaluateHistoryVivaAnswer(
  vivaQuestion: string,
  studentAnswer: string,
  sampleAnswer?: string,
  combinedStudentAnswer?: string,
): VivaAnswerEvaluation {
  const answer = studentAnswer.trim();
  const combined = (combinedStudentAnswer ?? answer).trim();
  const words = answer.split(/\s+/).filter(Boolean);

  if (sampleAnswer?.trim()) {
    return evaluateHistoryVivaAnswerFromModel(answer, sampleAnswer, combined);
  }

  if (words.length < 3) {
    return {
      advance: false,
      feedback:
        'That is quite brief. Think about the key clinical point in the question and try again.',
    };
  }

  const keywords = vivaQuestionKeywords(vivaQuestion);
  const lower = answer.toLowerCase();
  const hits = keywords.filter((keyword) => lower.includes(keyword));
  if (hits.length >= 1 || words.length >= 14) {
    return { advance: true, feedback: 'Good.' };
  }

  return {
    advance: false,
    feedback:
      'Not complete yet — give a focused clinical point, then build on it if more are expected.',
  };
}

function parseVivaAnswerEvaluation(
  raw: string,
  fallback: () => VivaAnswerEvaluation,
): VivaAnswerEvaluation {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return fallback();
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      advance?: unknown;
      feedback?: unknown;
    };
    if (typeof parsed.advance !== 'boolean') return fallback();
    const feedback = typeof parsed.feedback === 'string' ? parsed.feedback.trim() : '';
    if (!feedback) return fallback();
    if (/question\s+\d+\s+of\s+\d+/i.test(feedback)) return fallback();
    return { advance: parsed.advance, feedback };
  } catch {
    return fallback();
  }
}

/** Score a single history-station viva answer; advance only when correct enough or student gave up. */
export async function evaluateHistoryVivaAnswer(
  caseData: Case,
  vivaQuestion: string,
  questionNumber: number,
  studentAnswer: string,
  sampleAnswer = '',
  combinedStudentAnswer?: string,
): Promise<VivaAnswerEvaluation> {
  const settings = await getAISettings();
  const provider = process.env.AI_PROVIDER || settings.provider;
  const combined = (combinedStudentAnswer ?? studentAnswer).trim();
  const fallback = () =>
    mockEvaluateHistoryVivaAnswer(vivaQuestion, studentAnswer, sampleAnswer, combined);

  if (sampleAnswer.trim()) {
    return evaluateHistoryVivaAnswerFromModel(studentAnswer, sampleAnswer, combined);
  }

  if (provider === 'mock' || provider === 'demo') {
    return fallback();
  }

  const knowledgeContext = await getRoleKnowledgeContext({
    categoryId: caseData.categoryId,
    caseId: caseData.id,
    role: 'examiner',
  });
  const modelAnswerBlock = sampleAnswer.trim()
    ? `\nMODEL ANSWER (marking key from case author — NEVER reveal verbatim to student):\n${sampleAnswer.trim()}\n\nUse this as the primary marking key. Score each key point in the model answer.`
    : '';

  const priorAttempts =
    combinedStudentAnswer && combinedStudentAnswer.trim() !== studentAnswer.trim()
      ? combinedStudentAnswer
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && line !== studentAnswer.trim())
      : [];

  const attemptBlock =
    priorAttempts.length > 0
      ? `\nPrevious attempts for this SAME question (score together with the latest attempt):\n${priorAttempts.map((attempt, index) => `${index + 1}. ${attempt}`).join('\n')}\n`
      : '';

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a senior OSCE examiner marking one history viva answer.

CASE: ${caseData.titleEn}
DIAGNOSIS (reference only — do not reveal to student): ${caseData.finalDiagnosis}
${modelAnswerBlock}

RULES:
1. Respond in English only in the feedback field (2-4 sentences).
2. The student may answer across MULTIPLE attempts for the SAME question. Score ALL attempts together.
3. advance=true ONLY when every key point in the model answer is covered across all attempts.
4. PARTIAL CREDIT (critical): if the student gives ONE correct cause/point when several are expected, advance=false. Say clearly that this point is CORRECT but the answer is still incomplete, then give a short hint toward what is missing (category/topic only — NEVER quote the full model answer). Never say the whole answer is wrong when part of it is right.
5. advance=false if the latest attempt is substantially wrong, off-topic, or too vague — unless earlier attempts already covered enough points. Prefer "not complete yet" over "not quite / wrong".
6. When advance=false with partial credit: praise what is already correct cumulatively; do NOT ask for points they already gave in earlier attempts. If they repeat the same point, say so briefly and ask for the next category only.
7. When advance=true: brief acknowledgement only (e.g. "Correct — all key points covered.") — never include the next question text and never write "Question N of M".
8. Return ONLY valid JSON: {"advance":true|false,"feedback":"..."}${knowledgeContext}`,
    },
    {
      role: 'user',
      content: `Viva question: ${vivaQuestion}${attemptBlock}\nLatest student attempt: ${studentAnswer}\n\nCombined answer so far:\n${combined}`,
    },
  ];

  const raw = await callOpenAISafe(
    messages,
    settings.examinerModel,
    0.25,
    220,
    () => JSON.stringify(fallback()),
    { feature: 'examiner_viva' },
  );

  return parseVivaAnswerEvaluation(raw, fallback);
}

export async function getExaminerVivaResponse(
  caseData: Case,
  question: string,
  history: { role: string; content: string }[],
  language: Language = 'AR',
  usageMeta?: Omit<AiUsageMeta, 'feature'>,
): Promise<string> {
  const lang = resolveExaminerLanguage(language, question);
  const settings = await getAISettings();
  const provider = process.env.AI_PROVIDER || settings.provider;
  const caseTitle = lang === 'AR' ? caseData.titleAr || caseData.titleEn : caseData.titleEn;

  if (provider === 'mock' || provider === 'demo') {
    return finalizeExaminerReply(
      lang === 'AR'
      ? `محاولة كويسة. في حالة ${caseTitle}، فكّر في التشخيصات التفريقية والتحاليل اللي بعد كده.`
      : `Good attempt. For this case (${caseTitle}), consider also discussing differential diagnoses and next investigation steps.`,
      lang,
    );
  }

  const knowledgeContext = await getRoleKnowledgeContext({
    categoryId: caseData.categoryId,
    caseId: caseData.id,
    role: 'examiner',
  });
  const promptHistory = chatContextWindow(history, settings.maxContextMessages, true);
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are an Egyptian OSCE examiner conducting a viva for case: ${caseTitle}.

CORRECT DIAGNOSIS (reference — do not reveal immediately): ${caseData.finalDiagnosis}
TEACHING POINTS / EXPECTED MANAGEMENT (marking key from case author):
${caseData.teachingPoints || '(not specified)'}

RULES:
1. Ask focused follow-up questions and give brief constructive feedback.
2. PARTIAL CREDIT: if the student states 3 of 4 expected points, acknowledge the 3 correct points and ask only about what is missing. Do NOT say the entire answer is wrong.
3. Use the teaching points above as your marking reference — stay aligned with the case author's expected answer.
4. Do not reveal the full model answer immediately unless the student has clearly failed after a reasonable attempt.
5. ${examinerLangRule(lang)}${knowledgeContext}${adminSystemPromptSuffix(settings, lang, 'examiner')}`,
    },
    ...promptHistory.map((m) => ({
      role: (m.role === 'STUDENT' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ];

  const reply = await callOpenAISafe(
    messages,
    process.env.OPENAI_VOICE_MODEL || settings.examinerModel,
    Math.min(settings.temperature, 0.4),
    Math.min(settings.maxTokens, CHAT_EXAMINER_MAX_TOKENS),
    () =>
      lang === 'AR'
        ? `محاولة كويسة. في حالة ${caseTitle}، فكّر في التشخيصات التفريقية والتحاليل اللي بعد كده.`
        : `Good attempt. For this case (${caseTitle}), consider also discussing differential diagnoses and next investigation steps.`,
    { feature: 'examiner_viva', userId: usageMeta?.userId, sessionId: usageMeta?.sessionId },
    { timeoutMs: VOICE_TIMEOUT_MS },
  );
  const finalized = finalizeExaminerReply(reply, lang);
  return finalized.trim() || (lang === 'AR'
    ? `محاولة كويسة. في حالة ${caseTitle}، فكّر في التشخيصات التفريقية والتحاليل اللي بعد كده.`
    : `Good attempt. For this case (${caseTitle}), consider also discussing differential diagnoses and next investigation steps.`);
}

function maneuverLabel(
  maneuverId: string,
  isArabic: boolean,
  stationConfigRaw?: string | null,
) {
  return resolveManeuverLabel(
    maneuverId,
    parseStationConfig(stationConfigRaw),
    isArabic ? 'ar' : 'en',
  );
}

export function getManeuverOpeningMessage(
  _caseData: Case,
  maneuverId: string,
  _language: Language,
  stationConfig?: import('../lib/stationConfig.js').StationConfig,
): string {
  if (stationConfig) {
    return resolveManeuverOpeningMessage(maneuverId, stationConfig);
  }
  return resolveManeuverOpeningMessage(maneuverId, parseStationConfig(null));
}

export async function getManeuverExaminerResponse(
  caseData: Case,
  maneuverId: string,
  question: string,
  history: { role: string; content: string }[],
  _language: Language,
  usageMeta?: Omit<AiUsageMeta, 'feature'>,
): Promise<string> {
  const lang = examinationExaminerLanguage();
  const settings = await getAISettings();
  const provider = process.env.AI_PROVIDER || settings.provider;
  const name = maneuverLabel(maneuverId, false, caseData.stationConfig);
  const caseTitle = caseData.titleEn;
  const physicalExam = parsePhysicalExamForm(caseData.physicalExam);
  const maneuverFindings =
    physicalExam[maneuverId as keyof typeof physicalExam]?.trim() || '';

  // "I don't know" → reveal expected findings immediately.
  if (studentGaveUpAnswer(question)) {
    if (maneuverFindings) {
      return `No problem — here are the expected ${name} findings:\n${maneuverFindings}`;
    }
    return `That's fine — it's good to say when you're unsure. For ${name}, review the key clinical signs linked to this case and we can continue.`;
  }

  // Fast local partial-credit path when case author provided structured findings.
  if (maneuverFindings) {
    const local = evaluateHistoryVivaAnswerFromModel(question, maneuverFindings);
    if (local.feedback?.trim()) {
      // Examination stays progressive: never treat as fully finished station.
      if (local.advance) {
        return `${local.feedback} You may continue refining technique or move to the next examination step when ready.`;
      }
      return local.feedback;
    }
  }

  if (provider === 'mock' || provider === 'demo') {
    return `Good attempt on ${name}. Consider differential diagnoses and the next examination step.`;
  }

  const knowledgeContext = await getRoleKnowledgeContext({
    categoryId: caseData.categoryId,
    caseId: caseData.id,
    role: 'examiner',
  });
  const promptHistory = chatContextWindow(history, settings.maxContextMessages, true);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a senior OSCE clinical examiner conducting an oral viva for the "${name}" step of the physical examination.

CASE: ${caseTitle}
DIAGNOSIS (hidden from student): ${caseData.finalDiagnosis}
EXPECTED FINDINGS FOR ${name.toUpperCase()} (marking key from case author — do not read verbatim):
${maneuverFindings || '(No specific findings configured — use diagnosis context only)'}

RULES:
1. Evaluate the student's spoken findings for ${name} only, against the expected findings above.
2. PARTIAL CREDIT IS REQUIRED: if the student correctly states even ~10% of expected findings, acknowledge what was correct and give a progressive hint for what is missing. Never mark the whole answer wrong when any point is correct.
3. Ask one focused follow-up question OR give brief constructive feedback (2-3 short sentences).
4. Do NOT reveal the full diagnosis or full model findings immediately.
5. Probe technique, expected findings, and clinical reasoning.
6. Keep replies concise for live voice turns.
7. ${examinerLangRule(lang)}${knowledgeContext}${adminSystemPromptSuffix(settings, lang, 'examiner')}`,
    },
    ...promptHistory.map((m) => ({
      role: (m.role === 'STUDENT' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ];

  const reply = await callOpenAISafe(
    messages,
    process.env.OPENAI_VOICE_MODEL || settings.examinerModel,
    Math.min(settings.temperature, 0.4),
    Math.min(settings.maxTokens, CHAT_EXAMINER_MAX_TOKENS),
    () =>
      maneuverFindings
        ? evaluateHistoryVivaAnswerFromModel(question, maneuverFindings).feedback ||
          `Good attempt on ${name}. Consider differential diagnoses and the next examination step.`
        : `Good attempt on ${name}. Consider differential diagnoses and the next examination step.`,
    { feature: 'examiner_viva', userId: usageMeta?.userId, sessionId: usageMeta?.sessionId },
    { timeoutMs: VOICE_TIMEOUT_MS },
  );
  const finalized = finalizeExaminerReply(reply, lang);
  return finalized.trim() || `Good attempt on ${name}. Consider differential diagnoses and the next examination step.`;
}

const GAVE_UP_ANSWER_PATTERNS = [
  /\b(i\s*)?(don'?t|do\s*not)\s*know\b/i,
  /\bidk\b/i,
  /\bnot\s*sure\b/i,
  /\bno\s*idea\b/i,
  /\bpass\b/i,
  /مش\s*عارف|مش\s*عارفه|معرفش|معنديش\s*فكره|لا\s*أعرف|ما\s*اعرف|منعرفش/i,
];

function studentGaveUpAnswer(answer: string): boolean {
  const normalized = answer.trim();
  if (!normalized) return false;
  return GAVE_UP_ANSWER_PATTERNS.some((pattern) => pattern.test(normalized));
}
