import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildGeminiLiveSessionConfig,
  createGeminiLiveEphemeralToken,
  GEMINI_LIVE_MODEL,
  isLiveVoiceSessionType,
} from './geminiLiveService.js';
import type { RealtimePatientCase } from './aiService.js';
import type { PatientBehavior } from '../lib/stationConfig.js';

const caseData: RealtimePatientCase = {
  patientName: 'Mariam',
  patientAge: 32,
  patientGender: 'female',
  patientNationality: 'Egyptian',
  patientBirthPlace: 'Cairo',
  patientResidence: 'Giza',
  patientOccupation: 'Teacher',
  patientMaritalStatus: 'Married',
  patientSmokingStatus: 'Non-smoker',
  patientAlcoholStatus: 'None',
  medicationHistory: 'No regular medication',
  familyHistory: 'Mother has diabetes',
  socialHistory: 'Lives with family',
  surgicalHistory: 'None',
  chiefComplaint: 'Abdominal pain',
  medicalHistory: 'Pain for two days',
  patientPersonality: 'Cooperative but worried',
  scenarioPrompt: 'Respond only as the patient in this OSCE case.',
};

const patientBehavior: PatientBehavior = {
  instructions: 'Give short answers unless asked for detail.',
  tone: 'anxious',
  emotion: 'worried',
  preferredLanguage: 'AR',
  constraints: 'Do not reveal the diagnosis.',
};

test('Live Voice config uses the documented model and existing case/persona settings', () => {
  const config = buildGeminiLiveSessionConfig(caseData, 'AR', patientBehavior);
  const prompt = config.systemInstruction.parts[0].text;

  assert.equal(GEMINI_LIVE_MODEL, 'gemini-3.8-live');
  assert.deepEqual(config.responseModalities, ['AUDIO']);
  assert.ok(prompt.includes('Mariam'));
  assert.ok(prompt.includes('Abdominal pain'));
  assert.ok(prompt.includes('Cooperative but worried'));
  assert.ok(prompt.includes('Give short answers unless asked for detail.'));
  assert.ok(prompt.includes('العامية المصرية'));
  assert.deepEqual(config.inputAudioTranscription, {});
  assert.deepEqual(config.outputAudioTranscription, {});
});

test('only LIVE_VOICE session types pass the transport guard', () => {
  assert.equal(isLiveVoiceSessionType('LIVE_VOICE'), true);
  assert.equal(isLiveVoiceSessionType('CHAT'), false);
  assert.equal(isLiveVoiceSessionType(undefined), false);
});

test('ephemeral token provisioning keeps the permanent API key server-side', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestHeaders: Headers | undefined;
  let requestBody = '';
  process.env.GEMINI_API_KEY = 'server-only-test-key';
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestHeaders = new Headers(init?.headers);
    requestBody = String(init?.body);
    return new Response(JSON.stringify({ name: 'auth_tokens/short-lived' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await createGeminiLiveEphemeralToken(
      buildGeminiLiveSessionConfig(caseData, 'AR', patientBehavior),
    );
    assert.equal(requestUrl, 'https://generativelanguage.googleapis.com/v1beta/auth_tokens');
    assert.equal(requestHeaders?.get('x-goog-api-key'), 'server-only-test-key');
    assert.ok(requestBody.includes('"uses":1'));
    assert.ok(requestBody.includes('"model":"models/gemini-3.8-live"'));
    assert.equal(result.token, 'auth_tokens/short-lived');
    assert.equal(result.model, 'gemini-3.8-live');
    assert.equal(JSON.stringify(result).includes('server-only-test-key'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});
