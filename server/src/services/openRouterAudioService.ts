import { containsWrongScriptForArabic, fixArabicSpeechTranscript, looksLikeSttHallucination } from './arabicSttFix.js';

export const OPENROUTER_TTS_MODEL = 'x-ai/grok-voice-tts-1.0';
// Whisper Turbo accepts the WebM/Opus container emitted by Chrome's
// MediaRecorder, unlike the previous model which rejected real browser clips.
// Deployments can still compare a different STT model through the env override.
export const OPENROUTER_TRANSCRIPTION_MODEL = 'openai/whisper-large-v3-turbo';
const OPENROUTER_TTS_URL = 'https://openrouter.ai/api/v1/audio/speech';
const OPENROUTER_TRANSCRIPTION_URL = 'https://openrouter.ai/api/v1/audio/transcriptions';
const STT_REQUEST_TIMEOUT_MS = 15_000;
const STT_NETWORK_RETRY_DELAYS_MS = [250, 600];
const STT_HALLUCINATION_RETRY_DELAY_MS = 250;

type OpenRouterStage = 'transcription' | 'audio-generation';
type OpenRouterInputMeta = {
  mimeType?: string;
  byteSize?: number;
  format: string;
  base64Length: number;
  recordingDurationMs?: number;
  speechDurationMs?: number;
};

export class OpenRouterAudioError extends Error {
  constructor(
    public readonly stage: OpenRouterStage,
    public readonly code: string,
    public readonly upstreamStatus?: number,
  ) {
    super(code);
  }
}

export type OpenRouterTranscriptionDiagnostics = {
  transcript: string;
  attempts: number;
  networkRetries: number;
  hallucinationRetries: number;
  salvagedBoilerplate: boolean;
};

function sanitizeProviderError(body: string): string {
  return body
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9._-]+/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

function sanitizeTranscriptForLog(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function logOpenRouterFailure(input: {
  stage: OpenRouterStage;
  status?: number;
  model: string;
  metadata: OpenRouterInputMeta;
  providerMessage: string;
  attempt?: number;
  retrying?: boolean;
  errorName?: string;
  errorCode?: string;
  causeName?: string;
  causeCode?: string;
  timedOut?: boolean;
}) {
  console.warn('[openrouter-audio]', {
    stage: input.stage,
    status: input.status ?? null,
    model: input.model,
    mimeType: input.metadata.mimeType ?? `audio/${input.metadata.format}`,
    format: input.metadata.format,
    byteSize: input.metadata.byteSize ?? Math.floor(input.metadata.base64Length * 0.75),
    recordingDurationMs: input.metadata.recordingDurationMs ?? null,
    speechDurationMs: input.metadata.speechDurationMs ?? null,
    providerMessage: sanitizeProviderError(input.providerMessage),
    attempt: input.attempt ?? null,
    retrying: input.retrying ?? false,
    errorName: input.errorName ?? null,
    errorCode: input.errorCode ?? null,
    causeName: input.causeName ?? null,
    causeCode: input.causeCode ?? null,
    timedOut: input.timedOut ?? false,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchErrorDetails(error: unknown, timedOut: boolean) {
  const source = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const cause = source.cause && typeof source.cause === 'object' ? source.cause as Record<string, unknown> : {};
  return {
    providerMessage: error instanceof Error ? error.message : 'network failure',
    errorName: typeof source.name === 'string' ? source.name : undefined,
    errorCode: typeof source.code === 'string' ? source.code : undefined,
    causeName: typeof cause.name === 'string' ? cause.name : undefined,
    causeCode: typeof cause.code === 'string' ? cause.code : undefined,
    timedOut,
  };
}

export function openRouterAudioInputFormat(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (!normalized.startsWith('audio/')) throw new Error('openrouter-audio-unsupported-format');
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('mp4') || normalized.includes('m4a')) return 'm4a';
  if (normalized.includes('ogg')) return 'ogg';
  // WebM is what current Chrome MediaRecorder produces. Keep its real format
  // rather than relabelling it as WAV; the provider can reject it explicitly.
  if (normalized.includes('webm')) return 'webm';
  throw new Error('openrouter-audio-unsupported-format');
}

export function isOpenRouterAudioEnabled() {
  return process.env.VOICE_PROVIDER === 'openrouter_audio';
}

export function resolveOpenRouterAudioVoice(patientGender?: string | null): string {
  const gender = patientGender?.trim().toLowerCase();
  if (gender === 'female' || gender === 'f') {
    return process.env.OPENROUTER_TTS_VOICE_FEMALE?.trim() || process.env.OPENROUTER_TTS_VOICE?.trim() || 'ara';
  }
  if (gender === 'male' || gender === 'm') {
    return process.env.OPENROUTER_TTS_VOICE_MALE?.trim() || process.env.OPENROUTER_TTS_VOICE?.trim() || 'rex';
  }
  return process.env.OPENROUTER_TTS_VOICE?.trim() || 'ara';
}

function openRouterHeaders(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://medsynoza.com',
    'X-Title': process.env.OPENROUTER_APP_NAME || 'Synoza OSCE',
  };
}

function isStandaloneThanks(text: string): boolean {
  return /^(شكراً|شكرا|thanks?|shukran)[.!؟?]*$/i.test(text.trim());
}

function stripLikelyTrailingSttOutro(text: string): string {
  // Keep a genuine standalone thank-you intact. A trailing thank-you after a
  // substantive question, however, is a common Whisper-style outro artifact
  // and does not change the clinical question being asked.
  return text.replace(/(?:\s|،|,)\s*(?:شكراً|شكرا|thanks?|shukran)[.!؟?]*$/i, '').trim();
}

/**
 * Whisper can prepend or append video-subtitle boilerplate to otherwise valid
 * speech. This is deliberately limited to known non-speech wrappers at a
 * transcript boundary: it never supplies or rewrites the student's words.
 */
const STT_SUBTITLE_BOILERPLATE = String.raw`(?:ترجم(?:ة|ه)?\s+نانسي(?:\s+(?:قنقر|قنكر|كونكر))?|اشترك(?:وا|و|ي)?\s+(?:في|فى)\s+(?:ال)?قناة|(?:شكرا|شكراً)\s+(?:للمشاهدة|على\s+المشاهدة|لمشاهدتك|للاستماع))`;
const STT_SUBTITLE_PREFIX = new RegExp(`^${STT_SUBTITLE_BOILERPLATE}(?=$|[\\s،,.!؟?])(?:[\\s،,.!؟?]+)?`, 'i');
const STT_SUBTITLE_SUFFIX = new RegExp(`(?:[\\s،,.!؟?]+)?${STT_SUBTITLE_BOILERPLATE}$`, 'i');
const STT_REPEATED_THANKS_PREFIX = /^(?:(?:شكرا|شكراً)\s+){2,}/i;
const STT_REPEATED_THANKS_SUFFIX = /(?:\s+(?:شكرا|شكراً)){2,}$/i;

export function salvageOpenRouterTranscript(text: string): { text: string; removedBoilerplate: boolean } {
  let remaining = text.trim().replace(/\s+/g, ' ');
  let removedBoilerplate = false;

  // Peeling is intentional: a result can have several wrappers, e.g.
  // "شكرا شكرا ترجمة نانسي قنقر <actual question>".
  while (remaining) {
    const withoutRepeatedThanks = remaining.replace(STT_REPEATED_THANKS_PREFIX, '').trim();
    if (withoutRepeatedThanks !== remaining) {
      remaining = withoutRepeatedThanks;
      removedBoilerplate = true;
      continue;
    }
    const withoutPrefix = remaining.replace(STT_SUBTITLE_PREFIX, '').trim();
    if (withoutPrefix !== remaining) {
      remaining = withoutPrefix;
      removedBoilerplate = true;
      continue;
    }
    const withoutSuffix = remaining.replace(STT_SUBTITLE_SUFFIX, '').trim();
    if (withoutSuffix !== remaining) {
      remaining = withoutSuffix;
      removedBoilerplate = true;
      continue;
    }
    const withoutRepeatedTail = remaining.replace(STT_REPEATED_THANKS_SUFFIX, '').trim();
    if (withoutRepeatedTail !== remaining) {
      remaining = withoutRepeatedTail;
      removedBoilerplate = true;
      continue;
    }
    break;
  }

  // A short hesitation immediately after a removed wrapper is not meaningful
  // speech. Restrict this to the wrapper-removal path so genuine words are not
  // discarded from an otherwise clean transcript.
  if (removedBoilerplate) {
    remaining = remaining.replace(/^(?:[أا]م+ه?|ا+ه+|يعني)\s+/i, '').trim();
  }
  return { text: remaining, removedBoilerplate };
}

function normalizeEgyptianVoiceSpacing(text: string): string {
  // Whisper can split the colloquial complaint-opening token "مالك" into
  // "ما لك". Keep the spoken meaning while giving the existing deterministic
  // intent layer its canonical Egyptian form; this is STT normalization, not a
  // new patient-answer rule.
  return text
    .replace(/(^|[\s،,])ما\s+لك(?=$|[\s؟?،,.])/g, '$1مالك')
    // Whisper can vowel-spell the same colloquial opener as "ملكي". This is
    // normalized only in voice STT, before the established patient intent map.
    .replace(/(^|[\s،,])ملكي(?:ه)?(?=$|[\s؟?،,.])/g, '$1مالك')
    .replace(/(^|[\s،,])ملك(?=$|[\s؟?،,.])/g, '$1مالك')
    // In the colloquial opener before "يا", Whisper occasionally writes
    // "ملكة" for "مالك". Keep this context-bound so unrelated words remain
    // untouched.
    .replace(/(^|[\s،,])ملكة(?=\s+يا(?:\s|$))/g, '$1مالك')
    // Another common Whisper segmentation of "بتشتكي". Canonicalizing the
    // spelling preserves the student's question for the existing complaint
    // intent without inventing any clinical detail.
    .replace(/(^|[\s،,])بيتش\s*(?:تكي|تيكي)(?=$|[\s؟?،,.])/g, '$1بتشتكي')
    .replace(/(^|[\s،,])(?:بتشتقي|بيتشتقي)(?=$|[\s؟?،,.])/g, '$1بتشتكي');
}

export function normalizeOpenRouterTranscript(
  text: string,
  language: string,
  forceArabic = false,
  speechDurationMs?: number,
  byteSize?: number,
): string {
  const expectArabic = forceArabic || language.toLowerCase().startsWith('ar');
  const salvaged = salvageOpenRouterTranscript(text);
  const raw = salvaged.text;
  // A genuine short "شكراً" remains valid. Only reject it when the browser VAD
  // found too little speech evidence, which is the classic silence/noise phantom.
  if (isStandaloneThanks(raw) && ((speechDurationMs !== undefined && speechDurationMs < 650) || (byteSize !== undefined && byteSize < 1_200))) {
    throw new Error('openrouter-transcription-invalid');
  }
  // Do not convert a provider-returned Arabic thank-you into "إزيك". That
  // historical browser-STT correction is useful elsewhere but masks this signal.
  const withoutLikelyOutro = isStandaloneThanks(raw) ? raw : stripLikelyTrailingSttOutro(raw);
  const normalized = normalizeEgyptianVoiceSpacing(isStandaloneThanks(withoutLikelyOutro)
    ? withoutLikelyOutro
    : fixArabicSpeechTranscript(withoutLikelyOutro, expectArabic));
  if (!normalized || (expectArabic && (containsWrongScriptForArabic(normalized) || looksLikeSttHallucination(normalized)))) {
    throw new Error('openrouter-transcription-invalid');
  }
  const segments = normalized.split(/[؟?]/).map((part) => part.trim()).filter((part) => part.length > 1);
  if (!segments.length) throw new Error('openrouter-transcription-invalid');
  const primary = segments[segments.length - 1];
  return /[؟?]$/.test(normalized) ? `${primary}${normalized.endsWith('؟') ? '؟' : '?'}` : primary;
}

type OpenRouterTranscriptionInput = {
  audioBase64: string;
  format: string;
  language: string;
  forceArabic?: boolean;
  mimeType?: string;
  byteSize?: number;
  recordingDurationMs?: number;
  speechDurationMs?: number;
};

/**
 * Dedicated OpenRouter STT; this intentionally never calls the OpenAI SDK.
 * Retries reuse the exact original audio bytes, so the browser stays in its
 * processing state and can never submit a duplicate turn.
 */
export async function transcribeOpenRouterAudioWithDiagnostics(
  input: OpenRouterTranscriptionInput,
): Promise<OpenRouterTranscriptionDiagnostics> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error('openrouter-audio-unavailable');
  const model = process.env.OPENROUTER_TRANSCRIPTION_MODEL || OPENROUTER_TRANSCRIPTION_MODEL;
  const metadata = {
    mimeType: input.mimeType, byteSize: input.byteSize, format: input.format, base64Length: input.audioBase64.length,
    recordingDurationMs: input.recordingDurationMs, speechDurationMs: input.speechDurationMs,
  };
  const code = input.forceArabic || input.language.toLowerCase().startsWith('ar') ? 'ar' : input.language.toLowerCase().startsWith('en') ? 'en' : undefined;
  console.info('[openrouter-audio][stt-request]', {
    model,
    language: code ?? 'auto',
    mimeType: metadata.mimeType ?? `audio/${metadata.format}`,
    format: metadata.format,
    byteSize: metadata.byteSize ?? Math.floor(metadata.base64Length * 0.75),
    recordingDurationMs: metadata.recordingDurationMs ?? null,
    speechDurationMs: metadata.speechDurationMs ?? null,
  });
  let attempts = 0;
  let networkRetries = 0;
  let hallucinationRetries = 0;

  while (true) {
    attempts += 1;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, STT_REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(OPENROUTER_TRANSCRIPTION_URL, {
        method: 'POST',
        headers: openRouterHeaders(key),
        signal: controller.signal,
        body: JSON.stringify({ model, input_audio: { data: input.audioBase64, format: input.format }, ...(code ? { language: code } : {}), temperature: 0 }),
      });
    } catch (error) {
      clearTimeout(timeout);
      const retrying = networkRetries < STT_NETWORK_RETRY_DELAYS_MS.length;
      const details = fetchErrorDetails(error, timedOut);
      logOpenRouterFailure({
        stage: 'transcription', model, metadata, attempt: attempts, retrying,
        ...details,
      });
      if (retrying) {
        await sleep(STT_NETWORK_RETRY_DELAYS_MS[networkRetries++]);
        continue;
      }
      throw new OpenRouterAudioError('transcription', 'openrouter-transcription-network-failed');
    }
    clearTimeout(timeout);

    if (!response.ok) {
      const providerMessage = await response.text().catch(() => 'unreadable upstream error');
      const retrying = (response.status === 429 || response.status >= 500) && networkRetries < STT_NETWORK_RETRY_DELAYS_MS.length;
      logOpenRouterFailure({ stage: 'transcription', status: response.status, model, metadata, providerMessage, attempt: attempts, retrying });
      if (retrying) {
        await sleep(STT_NETWORK_RETRY_DELAYS_MS[networkRetries++]);
        continue;
      }
      throw new OpenRouterAudioError('transcription', 'openrouter-transcription-failed', response.status);
    }

    const payload = await response.json() as { text?: unknown };
    if (typeof payload.text !== 'string') {
      logOpenRouterFailure({ stage: 'transcription', status: response.status, model, metadata, providerMessage: 'response did not contain text', attempt: attempts });
      throw new OpenRouterAudioError('transcription', 'openrouter-transcription-invalid', response.status);
    }
    console.info('[openrouter-audio][stt-response]', {
      model,
      status: response.status,
      attempt: attempts,
      rawTranscriptLength: payload.text.length,
      rawTranscript: sanitizeTranscriptForLog(payload.text),
    });
    try {
      const salvage = salvageOpenRouterTranscript(payload.text);
      const transcript = normalizeOpenRouterTranscript(payload.text, input.language, input.forceArabic, input.speechDurationMs, input.byteSize);
      console.info('[openrouter-audio][stt]', {
        model, language: code ?? 'auto', mimeType: metadata.mimeType ?? `audio/${metadata.format}`,
        byteSize: metadata.byteSize ?? Math.floor(metadata.base64Length * 0.75),
        recordingDurationMs: metadata.recordingDurationMs ?? null,
        speechDurationMs: metadata.speechDurationMs ?? null,
        attempts,
        networkRetries,
        hallucinationRetries,
        transcriptLength: transcript.length,
        transcript: sanitizeTranscriptForLog(transcript),
        salvagedBoilerplate: salvage.removedBoilerplate,
        hallucinationRejected: false,
      });
      return { transcript, attempts, networkRetries, hallucinationRetries, salvagedBoilerplate: salvage.removedBoilerplate };
    } catch {
      const retrying = hallucinationRetries < 1;
      logOpenRouterFailure({
        stage: 'transcription', status: response.status, model, metadata,
        providerMessage: 'empty or rejected transcript; hallucinationRejected=true',
        attempt: attempts,
        retrying,
      });
      if (retrying) {
        hallucinationRetries += 1;
        await sleep(STT_HALLUCINATION_RETRY_DELAY_MS);
        continue;
      }
      throw new OpenRouterAudioError('transcription', 'openrouter-transcription-hallucination', response.status);
    }
  }
}

export async function transcribeOpenRouterAudio(input: OpenRouterTranscriptionInput): Promise<string> {
  return (await transcribeOpenRouterAudioWithDiagnostics(input)).transcript;
}

/**
 * Dedicated TTS rendering only. It receives exact grounded text as `input`,
 * not a chat prompt, so it has no case context or student question to answer.
 */
export async function createOpenRouterPatientAudioTurn(input: {
  patientText: string; language: string; patientGender?: string | null;
  mimeType?: string; byteSize?: number;
}): Promise<{ audioBase64: string; format: string; latencyMs: number; firstResponseMs: number | null }> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error('openrouter-audio-unavailable');
  const model = process.env.OPENROUTER_TTS_MODEL?.trim() || OPENROUTER_TTS_MODEL;
  const voice = resolveOpenRouterAudioVoice(input.patientGender);
  const metadata = { mimeType: input.mimeType, byteSize: input.byteSize, format: 'mp3', base64Length: 0 };
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(OPENROUTER_TTS_URL, {
      method: 'POST', headers: openRouterHeaders(key),
      body: JSON.stringify({ model, input: input.patientText, voice, response_format: 'mp3' }),
    });
  } catch (error) {
    logOpenRouterFailure({ stage: 'audio-generation', model, metadata, providerMessage: error instanceof Error ? error.message : 'network failure' });
    throw new OpenRouterAudioError('audio-generation', 'openrouter-audio-failed');
  }
  if (!response.ok || !response.body) {
    const providerMessage = response.body ? await response.text().catch(() => 'unreadable upstream error') : 'empty upstream response body';
    logOpenRouterFailure({ stage: 'audio-generation', status: response.status, model, metadata, providerMessage });
    throw new OpenRouterAudioError('audio-generation', 'openrouter-audio-failed', response.status);
  }
  const audioBytes = new Uint8Array(await response.arrayBuffer());
  if (!audioBytes.byteLength) {
    logOpenRouterFailure({ stage: 'audio-generation', status: response.status, model, metadata, providerMessage: 'TTS returned an empty audio body' });
    throw new OpenRouterAudioError('audio-generation', 'openrouter-audio-no-output', response.status);
  }
  const latencyMs = Date.now() - started;
  console.info('[openrouter-audio][tts]', { model, voice, inputLength: input.patientText.length, audioBytes: audioBytes.byteLength, latencyMs });
  return { audioBase64: Buffer.from(audioBytes).toString('base64'), format: 'mp3', latencyMs, firstResponseMs: latencyMs };
}
