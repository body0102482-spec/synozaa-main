import { createHash } from 'node:crypto';
import type { Case } from '@prisma/client';
import { buildRealtimePatientInstructions } from './aiService.js';

function resolveRealtimeModel(): string {
  const explicit = process.env.OPENAI_REALTIME_MODEL?.trim();
  if (explicit) return explicit;
  const shared = process.env.OPENAI_MODEL?.trim();
  if (shared && /realtime/i.test(shared)) return shared;
  return 'gpt-realtime-2.1-mini';
}

function resolveRealtimeLanguage(sessionLanguage: string): 'en' | 'ar' | undefined {
  if (sessionLanguage === 'EN') return 'en';
  if (sessionLanguage === 'AR') return 'ar';
  // AUTO: omit language so the realtime transcription model can detect English or Arabic.
  return undefined;
}

/** Configurable voices only: deployments choose names supported by their model. */
export function resolveRealtimeVoice(caseData: Case): string {
  const gender = (caseData.patientGender || '').toLowerCase();
  if (gender.startsWith('f')) return process.env.OPENAI_REALTIME_VOICE_FEMALE || process.env.OPENAI_REALTIME_VOICE || 'alloy';
  if (gender.startsWith('m')) return process.env.OPENAI_REALTIME_VOICE_MALE || process.env.OPENAI_REALTIME_VOICE || 'alloy';
  return process.env.OPENAI_REALTIME_VOICE || 'alloy';
}

export function normalizeSdp(sdp: string): string {
  const lines = sdp.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  return `${lines.join('\r\n')}\r\n`;
}

/** WebRTC session shape — matches working Nova voice-call config (no manual PCM format). */
export function buildRealtimeSessionConfig(caseData: Case, sessionLanguage: string) {
  const model = resolveRealtimeModel();
  const voice = resolveRealtimeVoice(caseData);
  const lang = resolveRealtimeLanguage(sessionLanguage);
  const transcribeModel =
    process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL || 'gpt-4o-transcribe';

  return {
    type: 'realtime',
    model,
    instructions: buildRealtimePatientInstructions(caseData, sessionLanguage),
    audio: {
      input: {
        transcription: {
          model: transcribeModel,
          ...(lang ? { language: lang } : {}),
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice,
      },
    },
  };
}

/** Typed transport error so routes can forward the right HTTP status. */
export class RealtimeCallError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/** Stable, privacy-preserving safety identifier (hashed user id — not the raw id). */
export function realtimesafetyIdentifier(userId: string): string {
  return createHash('sha256').update(`synoza-realtime:${userId}`).digest('hex');
}

/**
 * Unified WebRTC server-side connection flow (official guide):
 * the application server posts the browser SDP offer together with its session
 * configuration as a multipart form to `POST /v1/realtime/calls`, authenticated
 * with the standard OPENAI_API_KEY. No ephemeral client secrets are minted —
 * the permanent key never leaves this server and the browser never sees it.
 */
export async function createRealtimePatientCallAnswer(
  caseData: Case,
  sessionLanguage: string,
  sdpOffer: string,
  userId?: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!isRealtimeConfigured()) {
    throw new RealtimeCallError('realtime-unavailable', 503);
  }

  const normalizedSdp = normalizeSdp(sdpOffer);
  if (normalizedSdp.length < 100 || !normalizedSdp.includes('m=audio')) {
    console.warn('[realtime] rejected invalid SDP', { length: normalizedSdp.length });
    throw new RealtimeCallError('invalid-sdp', 400);
  }

  const sessionConfig = buildRealtimeSessionConfig(caseData, sessionLanguage);
  console.info('[realtime] creating call', {
    model: sessionConfig.model,
    transcribe: sessionConfig.audio?.input?.transcription?.model,
    language: sessionConfig.audio?.input?.transcription?.language,
    sdpLength: normalizedSdp.length,
  });

  const form = new FormData();
  form.set('sdp', normalizedSdp);
  form.set('session', JSON.stringify(sessionConfig));

  const response = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(userId
        ? { 'OpenAI-Safety-Identifier': realtimesafetyIdentifier(userId) }
        : {}),
    },
    body: form,
  });

  const answerSdp = await response.text();
  if (!response.ok) {
    console.error('[realtime] OpenAI call failed:', response.status, answerSdp);
    if (response.status === 401 || response.status === 403) {
      // Request reached OpenAI but was rejected — usually an invalid/revoked
      // server key. Surface it as "not configured" so the UI explains the fix.
      throw new RealtimeCallError('realtime-unavailable', 503);
    }
    throw new RealtimeCallError('realtime-call-failed', 502);
  }

  return answerSdp;
}

/**
 * Realtime must be independently configurable: only OPENAI_API_KEY decides.
 * The global AI_PROVIDER (openrouter for text AI) never gates voice calls.
 */
export function isRealtimeConfigured(): boolean {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey.startsWith('your-') || apiKey === 'sk-dummy' || apiKey.length < 20) {
    return false;
  }
  return true;
}
