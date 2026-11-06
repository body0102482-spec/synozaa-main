import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { Case } from '@prisma/client';
import {
  createOpenRouterAudioChatTurn,
  transcribeOpenRouterAudioChatInput,
} from './openRouterAudioService.js';
import { DEFAULT_PATIENT_BEHAVIOR } from '../lib/stationConfig.js';

const savedEnv = new Map<string, string | undefined>();
const envKeys = ['OPENROUTER_API_KEY', 'OPENROUTER_AUDIO_MODEL', 'OPENROUTER_AUDIO_VOICE', 'OPENAI_API_KEY'];
const savedFetch = globalThis.fetch;

const caseData = {
  patientName: 'Mona',
  patientAge: 40,
  patientGender: 'Female',
  patientNationality: 'Egyptian',
  patientBirthPlace: null,
  patientResidence: 'Cairo',
  patientOccupation: 'Teacher',
  patientMaritalStatus: 'Married',
  patientSmokingStatus: 'Non-smoker',
  patientAlcoholStatus: null,
  medicationHistory: 'None',
  familyHistory: 'None',
  socialHistory: 'Lives with family',
  surgicalHistory: 'None',
  chiefComplaint: 'Shortness of breath',
  medicalHistory: 'Symptoms for two weeks',
  patientPersonality: 'Cooperative',
  scenarioPrompt: 'OSCE patient',
} as Case;

beforeEach(() => {
  for (const key of envKeys) savedEnv.set(key, process.env[key]);
  process.env.OPENROUTER_API_KEY = 'server-only-test-key';
  process.env.OPENROUTER_AUDIO_MODEL = 'openai/gpt-audio-mini';
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  for (const key of envKeys) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = savedFetch;
});

test('sends student WAV audio and patient context to OpenRouter Chat Completions without an OpenAI key', async () => {
  let requestUrl = '';
  let requestHeaders: HeadersInit | undefined;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (input, init) => {
    requestUrl = String(input);
    requestHeaders = init?.headers;
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        choices: [{
          message: {
            content: 'I feel short of breath.',
            audio: { data: 'AQIDBA==', transcript: 'حاسّة بضيق في النفس.' },
          },
        }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const result = await createOpenRouterAudioChatTurn({
    audioBase64: 'UklGRg==',
    format: 'wav',
    studentTranscript: 'إزيك يا مريض؟',
    caseData,
    sessionLanguage: 'AR',
    patientBehavior: { ...DEFAULT_PATIENT_BEHAVIOR, tone: 'anxious' },
    history: [
      { role: 'STUDENT', content: 'إزيك؟' },
      { role: 'PATIENT', content: 'مش في أحسن حالي يا دكتور.' },
    ],
  });

  assert.equal(requestUrl, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(new Headers(requestHeaders).get('Authorization'), 'Bearer server-only-test-key');
  assert.equal(requestBody?.model, 'openai/gpt-audio-mini');
  assert.deepEqual(requestBody?.modalities, ['text', 'audio']);
  const messages = requestBody?.messages as Array<Record<string, unknown>>;
  assert.match(String(messages[0].content), /Egyptian colloquial Arabic/);
  assert.match(String(messages[0].content), /Tone: anxious/);
  assert.equal(messages[1].role, 'user');
  assert.equal(messages[2].role, 'assistant');
  const currentTurn = messages[3].content as Array<{
    text?: string;
    input_audio?: { data?: string; format?: string };
  }>;
  assert.match(currentTurn[0].text ?? '', /إزيك يا مريض/);
  assert.equal(currentTurn[1].input_audio?.data, 'UklGRg==');
  assert.equal(currentTurn[1].input_audio?.format, 'wav');
  assert.equal(result.transcript, 'حاسّة بضيق في النفس.');
  assert.equal(result.patientText, result.transcript);
  assert.equal(result.audioBase64, 'AQIDBA==');
  assert.equal(result.audioFormat, 'wav');
});

test('requires the configured OpenRouter audio model', async () => {
  delete process.env.OPENROUTER_AUDIO_MODEL;
  await assert.rejects(
    createOpenRouterAudioChatTurn({
      audioBase64: 'UklGRg==',
      format: 'wav',
      studentTranscript: 'Hello patient.',
      caseData,
      sessionLanguage: 'AUTO',
      patientBehavior: DEFAULT_PATIENT_BEHAVIOR,
      history: [],
    }),
    /openrouter-audio-model-unconfigured/,
  );
});

test('transcribes the student question with the configured audio model', async () => {
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'إزيك يا دكتور؟' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const transcript = await transcribeOpenRouterAudioChatInput({
    audioBase64: 'UklGRg==',
    format: 'wav',
    language: 'ar-EG',
    forceArabic: true,
    speechDurationMs: 1_000,
    byteSize: 1_500,
  });

  assert.equal(requestBody?.model, 'openai/gpt-audio-mini');
  assert.deepEqual(requestBody?.modalities, ['text']);
  assert.match(transcript, /إزيك يا دكتور/);
});
