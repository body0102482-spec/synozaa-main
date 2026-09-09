/**
 * OpenRouter STT + dedicated TTS experiment tests.
 * No network call is made: fetch is replaced with a local response fixture.
 */
import {
  OPENROUTER_TTS_MODEL,
  OPENROUTER_TRANSCRIPTION_MODEL,
  OpenRouterAudioError,
  createOpenRouterPatientAudioTurn,
  isOpenRouterAudioEnabled,
  normalizeOpenRouterTranscript,
  openRouterAudioInputFormat,
  resolveOpenRouterAudioVoice,
  salvageOpenRouterTranscript,
  transcribeOpenRouterAudio,
  transcribeOpenRouterAudioWithDiagnostics,
} from '../src/services/openRouterAudioService.js';
import { buildRealtimePatientInstructions } from '../src/services/aiService.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapPcm16AsWav } from '../../client/src/lib/pcmAudio.ts';

type CaseStub = Parameters<typeof buildRealtimePatientInstructions>[0];

const testCase = {
  patientName: 'سميرة أحمد', patientAge: 58, patientGender: 'Female', patientNationality: 'Egyptian',
  patientBirthPlace: null, patientResidence: null, patientOccupation: 'Retired teacher',
  patientMaritalStatus: null, patientSmokingStatus: 'Former smoker, quit 5 years ago', patientAlcoholStatus: null,
  chiefComplaint: 'Progressive shortness of breath and ankle swelling for 3 weeks',
  medicalHistory: 'Hypertension and type 2 diabetes', medicationHistory: 'Amlodipine and metformin',
  surgicalHistory: '', familyHistory: '', socialHistory: '', patientPersonality: '', scenarioPrompt: '',
  finalDiagnosis: 'Mitral regurgitation',
} as CaseStub;

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}`); }
}

console.log('\n=== OpenRouter audio experiment ===\n');
assert(OPENROUTER_TTS_MODEL === 'x-ai/grok-voice-tts-1.0', 'uses the dedicated OpenRouter TTS model slug');
assert(OPENROUTER_TRANSCRIPTION_MODEL === 'openai/whisper-large-v3-turbo', 'uses the WebM-compatible OpenRouter Whisper Turbo model by default');
assert(openRouterAudioInputFormat('audio/webm;codecs=opus') === 'webm', 'keeps Chrome WebM truthfully labelled');
assert(openRouterAudioInputFormat('audio/mp4') === 'm4a', 'maps mobile MP4 recording to m4a');
try { openRouterAudioInputFormat('video/mp4'); assert(false, 'rejects invalid audio mime type'); } catch { assert(true, 'rejects invalid audio mime type'); }

const originalProvider = process.env.VOICE_PROVIDER;
process.env.VOICE_PROVIDER = 'openrouter_audio';
assert(isOpenRouterAudioEnabled(), 'selects experimental path only via server VOICE_PROVIDER');
process.env.VOICE_PROVIDER = 'openai_realtime';
assert(!isOpenRouterAudioEnabled(), 'does not replace the Realtime path by default');
if (originalProvider === undefined) delete process.env.VOICE_PROVIDER; else process.env.VOICE_PROVIDER = originalProvider;

const instructions = buildRealtimePatientInstructions(testCase, 'AR');
assert(instructions.includes('Egyptian colloquial Arabic'), 'Arabic/Egyptian persona instruction is present');
assert(instructions.includes('Residence: NOT DOCUMENTED'), 'unknown structured demographics remain unknown');
assert(!instructions.includes('Diagnosis: Mitral regurgitation'), 'diagnosis is not supplied as patient-answer context');
assert(instructions.includes('Sex: Female'), 'case sex is present in grounded context');

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENROUTER_API_KEY;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalTranscriptionModel = process.env.OPENROUTER_TRANSCRIPTION_MODEL;
const originalAudioVoice = process.env.OPENROUTER_TTS_VOICE;
const originalMaleVoice = process.env.OPENROUTER_TTS_VOICE_MALE;
const originalFemaleVoice = process.env.OPENROUTER_TTS_VOICE_FEMALE;
let capturedAudioBody: Record<string, unknown> | undefined;
let capturedSttBody: Record<string, unknown> | undefined;
let failStt = false;
let failAudio = false;
let emptyAudio = false;
let sttRetrySequence: Array<'network' | '429' | 'hallucination' | 'wrapped-wellbeing' | 'wrapped-pnd'> = [];
process.env.OPENROUTER_API_KEY = 'server-only-test-key';
delete process.env.OPENAI_API_KEY;
delete process.env.OPENROUTER_TRANSCRIPTION_MODEL;
process.env.OPENROUTER_TTS_VOICE = 'ara';
process.env.OPENROUTER_TTS_VOICE_MALE = 'rex';
process.env.OPENROUTER_TTS_VOICE_FEMALE = 'eve';
globalThis.fetch = (async (url, init) => {
  const body = JSON.parse(String(init?.body));
  if (String(url).endsWith('/audio/transcriptions')) {
    capturedSttBody = body;
    if (failStt) return new Response(JSON.stringify({ error: 'unsupported input_audio format' }), { status: 400 });
    const nextRetry = sttRetrySequence.shift();
    if (nextRetry === 'network') {
      const cause = Object.assign(new Error('socket reset'), { code: 'ECONNRESET' });
      throw Object.assign(new TypeError('fetch failed'), { cause });
    }
    if (nextRetry === '429') return new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 });
    if (nextRetry === 'hallucination') {
      return new Response(JSON.stringify({ text: 'شكرا شكرا ترجمة نانسي قنقر' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (nextRetry === 'wrapped-wellbeing') {
      return new Response(JSON.stringify({ text: 'ترجمة نانسي قنقر كيف حالك طارق؟' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (nextRetry === 'wrapped-pnd') {
      return new Response(JSON.stringify({ text: 'اشتركوا في القناة النفس بيصحك من النوم؟' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ text: 'اتولدتي فين؟' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  capturedAudioBody = body;
  if (failAudio) return new Response(JSON.stringify({ error: { message: 'TTS failed' } }), { status: 400 });
  return new Response(emptyAudio ? new Uint8Array() : new Uint8Array([0xff, 0xfb, 0x90, 0x64]), {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}) as typeof fetch;

try {
  const transcript = await transcribeOpenRouterAudio({ audioBase64: 'AAEC', format: 'webm', language: 'ar-EG', forceArabic: true });
  assert(/اتولدتي|فين/.test(transcript), 'OpenRouter transcribes student audio without OPENAI_API_KEY');
  assert(capturedSttBody?.model === OPENROUTER_TRANSCRIPTION_MODEL, 'STT request uses the OpenRouter-only transcription model');
  assert((capturedSttBody?.input_audio as { format?: string })?.format === 'webm', 'STT request preserves the recorded audio format');
  assert(capturedSttBody?.language === 'ar', 'Arabic mode explicitly sends language ar to OpenRouter STT');
  assert(normalizeOpenRouterTranscript('إنت ساكن فين؟', 'ar-EG', true, 1_100, 4_000).includes('ساكن'), 'normal Egyptian Arabic transcript passes through unchanged');
  assert(normalizeOpenRouterTranscript('مالك يا طارق؟', 'ar-EG', true, 1_100, 4_000) === 'مالك يا طارق؟', 'short Egyptian Arabic wellbeing question is retained');
  assert(normalizeOpenRouterTranscript('ما لك يا طارق؟', 'ar-EG', true, 1_100, 4_000) === 'مالك يا طارق؟', 'Whisper spacing variant reaches the canonical Egyptian complaint intent');
  assert(normalizeOpenRouterTranscript('ملكي أطارق', 'ar-EG', true, 1_100, 4_000) === 'مالك أطارق', 'Whisper vowel-spelling variant reaches the canonical complaint opener');
  assert(normalizeOpenRouterTranscript('ملك يا تارك', 'ar-EG', true, 1_100, 4_000) === 'مالك يا تارك', 'Whisper shortened opener reaches the canonical complaint intent');
  assert(normalizeOpenRouterTranscript('ملكة يا تارك', 'ar-EG', true, 1_100, 4_000) === 'مالك يا تارك', 'Whisper contextual opener variant reaches the canonical complaint intent');
  assert(normalizeOpenRouterTranscript('بيتش تكي من ايه؟', 'ar-EG', true, 1_100, 4_000) === 'بتشتكي من ايه؟', 'Whisper segmented complaint wording reaches the canonical intent');
  assert(normalizeOpenRouterTranscript('بيتش تيكي من ايه؟', 'ar-EG', true, 1_100, 4_000) === 'بتشتكي من ايه؟', 'Whisper alternate segmented complaint wording reaches the canonical intent');
  assert(normalizeOpenRouterTranscript('بتشتقي من إيه', 'ar-EG', true, 1_100, 4_000) === 'بتشتكي من إيه', 'Whisper spelling variant reaches the canonical complaint intent');
  assert(normalizeOpenRouterTranscript('بيتشتقي من ايه', 'ar-EG', true, 1_100, 4_000) === 'بتشتكي من ايه', 'Whisper phonetic complaint variant reaches the canonical intent');
  assert(normalizeOpenRouterTranscript('بتشتكي من ايه؟', 'ar-EG', true, 1_100, 4_000) === 'بتشتكي من ايه؟', 'short Egyptian Arabic chief-complaint question is retained');
  assert(normalizeOpenRouterTranscript('النفس بيصحّيك من النوم؟', 'ar-EG', true, 1_100, 4_000).includes('بيصحّيك'), 'Arabic PND question is retained');
  assert(normalizeOpenRouterTranscript('بتاخد أدوية ايه؟', 'ar-EG', true, 1_100, 4_000).includes('أدوية'), 'Arabic medication question is retained');
  assert(normalizeOpenRouterTranscript('انت مولود فين؟', 'ar-EG', true, 1_100, 4_000).includes('مولود'), 'Arabic birthplace question is retained');
  assert(normalizeOpenRouterTranscript('بتشتكي من إيه؟ شكراً', 'ar-EG', true, 1_100, 4_000) === 'بتشتكي من إيه؟', 'known trailing STT outro is removed without changing the question');
  assert(normalizeOpenRouterTranscript('ترجمة نانسي قنقر كيف حالك طارق؟', 'ar-EG', true, 1_100, 4_000) === 'كيف حالك طارق؟', 'subtitle wrapper is salvaged without inventing a student question');
  assert(normalizeOpenRouterTranscript('اشتركوا في القناة النفس بيصحك من النوم؟', 'ar-EG', true, 1_100, 4_000).includes('النفس بيصحك من النوم'), 'channel wrapper is removed while the PND question is preserved');
  assert(normalizeOpenRouterTranscript('ترجمة نانسي قنقر أمه النفس بيصحيك من النوم؟', 'ar-EG', true, 1_100, 4_000).includes('النفس بيصحيك من النوم'), 'a hesitation after a removed wrapper is discarded without changing meaningful Arabic speech');
  assert(normalizeOpenRouterTranscript('مالك يا طارق؟', 'ar-EG', true, 1_100, 4_000) === 'مالك يا طارق؟', 'clean Arabic remains unchanged by wrapper salvage');
  assert(salvageOpenRouterTranscript('شكرا شكرا ترجمة نانسي قنقر').text === '', 'repeated thanks plus subtitle wrapper leaves no fabricated student speech');
  try {
    normalizeOpenRouterTranscript('ترجمة نانسي قنقر', 'ar-EG', true, 1_100, 4_000);
    assert(false, 'subtitle-only transcript is rejected after salvage');
  } catch {
    assert(true, 'subtitle-only transcript is rejected after salvage');
  }
  try {
    normalizeOpenRouterTranscript('شكراً', 'ar-EG', true, 250, 900);
    assert(false, 'standalone شكراً is rejected only with weak speech evidence');
  } catch {
    assert(true, 'standalone شكراً is rejected only with weak speech evidence');
  }
  assert(normalizeOpenRouterTranscript('شكراً', 'ar-EG', true, 1_100, 4_000) === 'شكراً', 'legitimate standalone شكراً is not blindly rejected');
  failStt = true;
  try {
    await transcribeOpenRouterAudio({ audioBase64: 'AAEC', format: 'webm', language: 'ar-EG', forceArabic: true });
    assert(false, 'failed OpenRouter transcription returns a recoverable error');
  } catch (error) {
    assert(error instanceof OpenRouterAudioError && error.stage === 'transcription' && error.upstreamStatus === 400, 'upstream STT 4xx is propagated as a recoverable error');
  }
  failStt = false;

  sttRetrySequence = ['network'];
  const networkRetry = await transcribeOpenRouterAudioWithDiagnostics({ audioBase64: 'AAEC', format: 'webm', language: 'ar-EG', forceArabic: true });
  assert(networkRetry.networkRetries === 1 && networkRetry.attempts === 2, 'transient fetch failure retries the same STT audio once and then succeeds');
  sttRetrySequence = ['429'];
  const rateLimitRetry = await transcribeOpenRouterAudioWithDiagnostics({ audioBase64: 'AAEC', format: 'webm', language: 'ar-EG', forceArabic: true });
  assert(rateLimitRetry.networkRetries === 1 && rateLimitRetry.attempts === 2, 'temporary STT 429 retries without changing the recording');
  sttRetrySequence = ['hallucination'];
  const hallucinationRetry = await transcribeOpenRouterAudioWithDiagnostics({ audioBase64: 'AAEC', format: 'webm', language: 'ar-EG', forceArabic: true });
  assert(hallucinationRetry.hallucinationRetries === 1 && hallucinationRetry.attempts === 2, 'one rejected Whisper hallucination retranscribes the same audio once');
  sttRetrySequence = ['wrapped-pnd'];
  const salvagedPnd = await transcribeOpenRouterAudioWithDiagnostics({ audioBase64: 'AAEC', format: 'webm', language: 'ar-EG', forceArabic: true });
  assert(salvagedPnd.salvagedBoilerplate && salvagedPnd.hallucinationRetries === 0 && salvagedPnd.transcript.includes('النفس بيصحك من النوم'), 'recoverable subtitle wrapper is salvaged without retranscribing the same audio');
  sttRetrySequence = ['wrapped-wellbeing'];
  const salvagedWellbeing = await transcribeOpenRouterAudioWithDiagnostics({ audioBase64: 'AAEC', format: 'webm', language: 'ar-EG', forceArabic: true });
  assert(salvagedWellbeing.salvagedBoilerplate && salvagedWellbeing.transcript === 'كيف حالك طارق؟', 'salvaged wellbeing transcript remains meaningful student speech');
  sttRetrySequence = ['hallucination', 'hallucination'];
  try {
    await transcribeOpenRouterAudio({ audioBase64: 'AAEC', format: 'webm', language: 'ar-EG', forceArabic: true });
    assert(false, 'two rejected hallucinations stop before Patient AI receives text');
  } catch (error) {
    assert(error instanceof OpenRouterAudioError && error.code === 'openrouter-transcription-hallucination', 'two rejected hallucinations return a recoverable unintelligible-audio error');
  }

  const originalWarn = console.warn;
  const warnings: unknown[] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  failAudio = true;
  try {
    await createOpenRouterPatientAudioTurn({
      patientText: 'مش متأكدة بصراحة.', language: 'AR', mimeType: 'audio/webm', byteSize: 3,
    });
    assert(false, 'upstream TTS 4xx is propagated as an audio-generation error');
  } catch (error) {
    assert(error instanceof OpenRouterAudioError && error.stage === 'audio-generation' && error.upstreamStatus === 400, 'upstream TTS 4xx is propagated as an audio-generation error');
  } finally {
    failAudio = false;
    console.warn = originalWarn;
  }
  assert(!JSON.stringify(warnings).includes('server-only-test-key'), 'diagnostic logs redact API keys');
  const diagnostic = warnings[0]?.[1] as { status?: number; model?: string; mimeType?: string; byteSize?: number } | undefined;
  assert(diagnostic?.status === 400 && diagnostic.model === OPENROUTER_TTS_MODEL && diagnostic.mimeType === 'audio/webm' && diagnostic.byteSize === 3, 'audio diagnostic identifies stage metadata without logging payloads');

  emptyAudio = true;
  try {
    await createOpenRouterPatientAudioTurn({ patientText: 'مش متأكدة بصراحة.', language: 'AR' });
    assert(false, 'empty TTS output fails recoverably');
  } catch (error) {
    assert(error instanceof OpenRouterAudioError && error.code === 'openrouter-audio-no-output', 'empty TTS output fails recoverably');
  } finally {
    emptyAudio = false;
  }

  const result = await createOpenRouterPatientAudioTurn({
    patientText: 'عندي ضيق في النفس بقاله حوالي أسبوعين.', language: 'AR', patientGender: 'Male',
  });
  assert(result.audioBase64 === Buffer.from([0xff, 0xfb, 0x90, 0x64]).toString('base64') && result.format === 'mp3', 'returns dedicated MP3 TTS audio without fabricating fallback audio');
  assert(capturedAudioBody?.model === OPENROUTER_TTS_MODEL, 'request sends dedicated TTS model slug to OpenRouter');
  assert(capturedAudioBody?.voice === 'rex', 'male cases use the configured male renderer voice');
  assert(resolveOpenRouterAudioVoice('Female') === 'eve', 'female cases use the configured female renderer voice');
  assert(capturedAudioBody?.response_format === 'mp3', 'dedicated TTS returns a browser-playable MP3 container');
  assert(capturedAudioBody?.input === 'عندي ضيق في النفس بقاله حوالي أسبوعين.', 'the exact grounded patient text is passed as TTS input');
  assert(!JSON.stringify(capturedAudioBody).includes('Mitral regurgitation') && !JSON.stringify(capturedAudioBody).includes('اتولدتي فين'), 'TTS receives no diagnosis, case record, or student question to reason from');
  assert(!JSON.stringify([capturedSttBody, capturedAudioBody]).includes('server-only-test-key'), 'API key is header-only and absent from request bodies');
  try { normalizeOpenRouterTranscript('', 'ar-EG', true); assert(false, 'empty OpenRouter transcription is recoverable'); } catch { assert(true, 'empty OpenRouter transcription is recoverable'); }

  const routesPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/routes/sessions.ts');
  const routesSource = await readFile(routesPath, 'utf8');
  assert(!routesSource.includes("from '../services/transcriptionService.js'"), 'OpenRouter route does not invoke the OpenAI transcription service');
  assert(routesSource.includes('role: MessageRole.STUDENT') && routesSource.includes('role: MessageRole.PATIENT'), 'route persists separate STUDENT and PATIENT transcript roles');
  assert(routesSource.includes('const patientText = await getPatientResponse(') && routesSource.includes('content: patientText'), 'PATIENT persistence comes from authoritative grounded text, not the audio-model transcript');
  assert(routesSource.includes('const transcript = await transcribeOpenRouterAudio(') && routesSource.includes('getPatientResponse(\n          session.case,\n          stageHistory,\n          transcript,'), 'a cleaned/salvaged transcript is the only student text passed to the grounded Patient AI');
  assert(!routesSource.includes('content: audio.text'), 'TTS audio can never overwrite persisted patient facts');
  assert(routesSource.includes("message === 'openrouter-transcription-failed'"), 'route exposes failed transcription as a recoverable response');
  assert(routesSource.includes("openrouter-transcription-network-failed") && routesSource.includes('code: error.code'), 'route returns distinct exhausted-provider and rejected-transcript error codes');
  assert(routesSource.includes('buffer.length < 200') && routesSource.includes('speechDurationMs') && routesSource.includes("'recording-too-short'"), 'near-silent or too-short experimental recordings fail recoverably before STT');

  const wav = wrapPcm16AsWav(new Uint8Array([0, 0, 255, 127]));
  const header = new TextDecoder().decode(wav.slice(0, 4));
  const view = new DataView(wav.buffer);
  assert(header === 'RIFF' && new TextDecoder().decode(wav.slice(8, 12)) === 'WAVE', 'PCM16 is wrapped in a real WAV container before browser playback');
  assert(view.getUint32(24, true) === 24_000 && view.getUint16(22, true) === 1 && view.getUint16(34, true) === 16, 'WAV header declares 24 kHz mono signed PCM16');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = originalKey;
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenAiKey;
  if (originalTranscriptionModel === undefined) delete process.env.OPENROUTER_TRANSCRIPTION_MODEL; else process.env.OPENROUTER_TRANSCRIPTION_MODEL = originalTranscriptionModel;
  if (originalAudioVoice === undefined) delete process.env.OPENROUTER_TTS_VOICE; else process.env.OPENROUTER_TTS_VOICE = originalAudioVoice;
  if (originalMaleVoice === undefined) delete process.env.OPENROUTER_TTS_VOICE_MALE; else process.env.OPENROUTER_TTS_VOICE_MALE = originalMaleVoice;
  if (originalFemaleVoice === undefined) delete process.env.OPENROUTER_TTS_VOICE_FEMALE; else process.env.OPENROUTER_TTS_VOICE_FEMALE = originalFemaleVoice;
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('All OpenRouter audio tests passed.\n');
