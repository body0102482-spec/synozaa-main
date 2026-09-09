import OpenAI, { toFile } from 'openai';
import { fixArabicSpeechTranscript, looksLikeSttHallucination, prioritizeWellbeingTranscript, containsWrongScriptForArabic, transcriptionNeedsArabicFix } from './arabicSttFix.js';

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

const ENGLISH_WHISPER_PROMPT = 'OSCE medical interview. Hello doctor.';
const ARABIC_WHISPER_PROMPT = 'دكتور مريض عامية مصرية OSCE';

const PROMPT_HALLUCINATION_PHRASES = [
  'السلام عليكم دكتور',
  'اسمك إيه',
  'عندك كام سنة',
  'إزيك',
  'إيه اللي جابك',
  'متجوز',
  'مصري',
];

export function looksLikePromptHallucination(text: string): boolean {
  const normalized = text.replace(/[؟?،,.]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  let hits = 0;
  for (const phrase of PROMPT_HALLUCINATION_PHRASES) {
    if (normalized.includes(phrase)) hits++;
  }
  return hits >= 3;
}

/** When STT returns multiple questions, keep the last one the student actually asked. */
export function extractPrimaryUtterance(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || looksLikePromptHallucination(trimmed) || looksLikeSttHallucination(trimmed)) {
    throw new Error('transcription-prompt-leak');
  }

  const segments = trimmed
    .split(/[؟?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !looksLikeSttHallucination(s));

  if (!segments.length) {
    throw new Error('transcription-prompt-leak');
  }

  if (segments.length === 1) return segments[0];

  const last = segments[segments.length - 1];
  return last.endsWith('؟') || last.endsWith('?') ? last : `${last}؟`;
}

export function resolveWhisperLanguage(
  language: string,
  forceArabic?: boolean,
): 'ar' | 'en' | 'auto' {
  if (forceArabic) return 'ar';
  const code = language.toLowerCase().trim();
  if (code === 'auto' || code === 'auto-detect') return 'auto';
  if (code.startsWith('ar')) return 'ar';
  if (code.startsWith('en')) return 'en';
  // Unknown / empty → let Whisper auto-detect (better for code-switching).
  return 'auto';
}

function transcriptionLooksWrong(text: string, expected: 'ar' | 'en' | 'auto'): boolean {
  if (expected === 'auto') return false;
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  if (expected === 'ar') return latin >= 4 && arabic === 0;
  return arabic >= 6 && latin === 0;
}

function needsWhisperArabicFallback(text: string, lang: 'ar' | 'en' | 'auto'): boolean {
  if (lang === 'auto') return false;
  if (lang !== 'ar') return transcriptionLooksWrong(text, lang);
  if (containsWrongScriptForArabic(text)) return true;
  const fixed = fixArabicSpeechTranscript(text, true);
  return transcriptionLooksWrong(text, lang) || transcriptionNeedsArabicFix(fixed, true);
}

function resolvePrimaryModel(): string {
  return process.env.OPENAI_WHISPER_MODEL || 'gpt-4o-transcribe';
}

async function runWhisper(
  client: OpenAI,
  buffer: Buffer,
  mimeType: string,
  whisperLang: 'ar' | 'en' | 'auto',
  model: string,
  usePrompt: boolean,
): Promise<string> {
  const ext = mimeType.includes('mp4')
    ? 'm4a'
    : mimeType.includes('ogg')
      ? 'ogg'
      : mimeType.includes('wav')
        ? 'wav'
        : 'webm';

  const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });
  const isRealtimeTranscribe = /transcribe/i.test(model);
  const canUsePrompt = usePrompt && !isRealtimeTranscribe && model === 'whisper-1' && whisperLang !== 'auto';

  const result = await client.audio.transcriptions.create({
    file,
    model,
    // Omit language for AUTO so Whisper can keep mixed Arabic/English.
    ...(whisperLang === 'auto' ? {} : { language: whisperLang }),
    ...(canUsePrompt
      ? { prompt: whisperLang === 'ar' ? ARABIC_WHISPER_PROMPT : ENGLISH_WHISPER_PROMPT }
      : {}),
    temperature: 0,
  });

  return result.text.trim();
}

function finalizeTranscript(
  text: string,
  expectArabic: boolean,
  options?: { fast?: boolean },
): string {
  let normalized = fixArabicSpeechTranscript(text, expectArabic);
  if (looksLikeSttHallucination(normalized, !expectArabic) || containsWrongScriptForArabic(normalized)) {
    throw new Error('transcription-prompt-leak');
  }
  if (options?.fast) {
    normalized = prioritizeWellbeingTranscript(normalized);
  }
  normalized = extractPrimaryUtterance(normalized);

  if (transcriptionNeedsArabicFix(normalized, expectArabic)) {
    throw new Error('transcription-not-arabic');
  }

  return normalized;
}

async function transcribeWithOpenAI(
  buffer: Buffer,
  mimeType: string,
  language: string,
  forceArabic: boolean | undefined,
  options?: { fast?: boolean },
): Promise<string> {
  const client = getOpenAIClient();
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  if (!client || provider === 'mock') {
    throw new Error('transcription-unavailable');
  }

  const whisperLang = resolveWhisperLanguage(language, forceArabic);
  const expectArabic = whisperLang === 'ar';
  const primaryModel = resolvePrimaryModel();
  const fallbackModel = 'whisper-1';

  let text = await runWhisper(client, buffer, mimeType, whisperLang, primaryModel, false);

  if (looksLikePromptHallucination(text)) {
    if (options?.fast) {
      throw new Error('transcription-prompt-leak');
    }
    text = await runWhisper(client, buffer, mimeType, whisperLang, primaryModel, false);
    if (looksLikePromptHallucination(text)) {
      throw new Error('transcription-prompt-leak');
    }
  }

  if (needsWhisperArabicFallback(text, whisperLang)) {
    try {
      text = await runWhisper(client, buffer, mimeType, whisperLang, fallbackModel, true);
    } catch {
      // Keep primary result if whisper retry fails.
    }
  }

  if (transcriptionNeedsArabicFix(text, expectArabic)) {
    if (primaryModel !== fallbackModel) {
      try {
        const whisperText = await runWhisper(
          client,
          buffer,
          mimeType,
          whisperLang,
          fallbackModel,
          true,
        );
        return finalizeTranscript(whisperText, expectArabic, options);
      } catch {
        // Fall through to error below.
      }
    }
    throw new Error('transcription-not-arabic');
  }

  return finalizeTranscript(text, expectArabic, options);
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  mimeType: string,
  language: string,
  forceArabic?: boolean,
  options?: { fast?: boolean },
): Promise<string> {
  if (buffer.length < 200) {
    throw new Error('recording-too-short');
  }

  const sttProvider = (process.env.STT_PROVIDER || 'openai').toLowerCase();
  if (sttProvider === 'local') {
    const { transcribeWithLocalWhisper } = await import('./localWhisperSttService.js');
    const whisperLang = resolveWhisperLanguage(language, forceArabic);
    const expectArabic = whisperLang === 'ar';
    const raw = await transcribeWithLocalWhisper(buffer, mimeType, language, forceArabic);
    return finalizeTranscript(raw, expectArabic, options);
  }

  return transcribeWithOpenAI(buffer, mimeType, language, forceArabic, options);
}
