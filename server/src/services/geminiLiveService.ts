import type { PatientBehavior } from '../lib/stationConfig.js';
import { buildRealtimePatientInstructions, type RealtimePatientCase } from './aiService.js';
import type { Case } from '@prisma/client';
import {
  buildRealtimeManeuverExaminerInstructions,
  buildRealtimeVivaExaminerInstructions,
  type ExaminerLiveManeuverContext,
  type ExaminerLiveVivaContext,
} from './examinerLiveService.js';

export const GEMINI_LIVE_MODEL = 'gemini-3.8-live';

export type GeminiLiveRole = 'PATIENT' | 'EXAMINER';

export interface GeminiLiveSessionConfig {
  responseModalities: ['AUDIO'];
  systemInstruction: { parts: Array<{ text: string }> };
  inputAudioTranscription: Record<string, never>;
  outputAudioTranscription: Record<string, never>;
  speechConfig?: {
    voiceConfig: { precomputedVoiceConfig: { voiceName: string } };
  };
}

export function isLiveVoiceSessionType(value: unknown): value is 'LIVE_VOICE' {
  return value === 'LIVE_VOICE';
}

/** Optional distinct Gemini Live voices per role (env-configured). */
function resolveLiveVoiceName(role: GeminiLiveRole): string | undefined {
  const raw =
    role === 'EXAMINER'
      ? process.env.GEMINI_LIVE_EXAMINER_VOICE
      : process.env.GEMINI_LIVE_PATIENT_VOICE;
  const name = raw?.trim();
  return name || undefined;
}

export interface GeminiLiveConfigOptions {
  role?: GeminiLiveRole;
  /** Required when role is EXAMINER. */
  examinerInstructions?: string;
}

export function buildGeminiLiveSessionConfig(
  caseData: RealtimePatientCase,
  sessionLanguage: string,
  patientBehavior: PatientBehavior,
  options: GeminiLiveConfigOptions = {},
): GeminiLiveSessionConfig {
  const role = options.role ?? 'PATIENT';
  const instructions =
    role === 'EXAMINER'
      ? options.examinerInstructions?.trim()
      : buildRealtimePatientInstructions(caseData, sessionLanguage, patientBehavior);
  if (!instructions) {
    throw new Error('gemini-live-instructions-missing');
  }

  const config: GeminiLiveSessionConfig = {
    responseModalities: ['AUDIO'],
    systemInstruction: { parts: [{ text: instructions }] },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
  const voiceName = resolveLiveVoiceName(role);
  if (voiceName) {
    config.speechConfig = {
      voiceConfig: { precomputedVoiceConfig: { voiceName } },
    };
  }
  return config;
}

export {
  buildRealtimeManeuverExaminerInstructions,
  buildRealtimeVivaExaminerInstructions,
};
export type { ExaminerLiveManeuverContext, ExaminerLiveVivaContext };
export type { Case as GeminiLiveCase };


export async function createGeminiLiveEphemeralToken(
  config: GeminiLiveSessionConfig,
): Promise<{ token: string; config: GeminiLiveSessionConfig; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('gemini-live-unavailable');
  }

  const now = Date.now();
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: `models/${GEMINI_LIVE_MODEL}`,
        config,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[gemini-live] ephemeral token request failed:', response.status, detail);
    throw new Error('gemini-live-token-failed');
  }

  const result = (await response.json()) as { name?: unknown };
  if (typeof result.name !== 'string' || !result.name) {
    throw new Error('gemini-live-token-invalid');
  }

  return { token: result.name, config, model: GEMINI_LIVE_MODEL };
}
