/**
 * Realtime live-call tests: config + live OpenAI client_secrets verification.
 * Run: npm run test:realtime
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildRealtimeSessionConfig,
  mintRealtimeClientSecret,
  resolveRealtimeVoice,
} from '../src/services/realtimePatientService.js';
import { sanitizeRealtimePatientTranscript } from '../src/services/aiService.js';
import { containsWrongScriptForArabic, isValidArabicSessionTranscript, looksLikeSttHallucination } from '../src/services/arabicSttFix.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../deploy/server.env.production') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

type CaseStub = Parameters<typeof buildRealtimeSessionConfig>[0];

const mockCase = {
  patientName: 'طارق مصطفى',
  patientAge: 17,
  patientGender: 'Male',
  patientNationality: 'Egyptian',
  patientBirthPlace: null, patientResidence: 'Shobra Al-Kheima, Cairo', patientOccupation: 'Apprentice painter',
  patientMaritalStatus: 'Single', patientSmokingStatus: 'Non-smoker', patientAlcoholStatus: null,
  chiefComplaint: 'ضيق نفس مع المجهود',
  medicalHistory: 'التهاب لوز قبل كده',
  medicationHistory: 'لا يوجد',
  surgicalHistory: 'لا يوجد',
  familyHistory: 'لا يوجد',
  socialHistory: 'من Shobra Al-Kheima, Cairo',
  patientPersonality: 'قلق',
  scenarioPrompt: 'OSCE',
  finalDiagnosis: 'Asthma',
} as CaseStub;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n=== Realtime session config (Nova-compatible) ===\n');
process.env.OPENAI_REALTIME_MODEL = 'gpt-realtime-mini';
const config = buildRealtimeSessionConfig(mockCase, 'AR');

assert(config.model === 'gpt-realtime-mini', 'model gpt-realtime-mini', config.model);
assert(config.audio?.output?.voice === 'alloy', 'output voice alloy', config.audio?.output?.voice);
assert(config.audio?.output?.format === undefined, 'no output format (WebRTC)');
assert(config.audio?.input?.format === undefined, 'no input format (WebRTC)');
assert(config.audio?.input?.turn_detection?.create_response === true, 'create_response true');
assert(
  config.audio?.input?.transcription?.model === 'gpt-4o-transcribe' ||
    config.audio?.input?.transcription?.model === 'whisper-1',
  'transcription model set',
  config.audio?.input?.transcription?.model,
);
assert(config.audio?.input?.turn_detection?.interrupt_response === true, 'interrupt_response true');
assert(!!config.instructions?.includes('ممنوع تسأل'), 'patient does not ask questions');
assert(!!config.instructions?.includes('إيه الأخبار'), 'greeting rule for ايه الاخبار');
assert(!!config.instructions?.includes('Residence: Shobra Al-Kheima, Cairo'), 'structured demographics are grounded in realtime instructions');
assert(!!config.instructions?.includes('NOT DOCUMENTED — do not infer'), 'unknown structured facts remain explicitly unknown');
assert(!config.instructions?.includes('Diagnosis: Asthma'), 'diagnosis is not presented as answerable context');
process.env.OPENAI_REALTIME_VOICE_MALE = 'male-configured-voice';
process.env.OPENAI_REALTIME_VOICE_FEMALE = 'female-configured-voice';
assert(resolveRealtimeVoice(mockCase) === 'male-configured-voice', 'male case selects configured realtime voice');
assert(resolveRealtimeVoice({ ...mockCase, patientGender: 'Female' }) === 'female-configured-voice', 'female case selects configured realtime voice');

console.log('\n=== Realtime patient transcript sanitization ===\n');
const sanitizedGreeting = sanitizeRealtimePatientTranscript(
  mockCase,
  'إيه الأخبار',
  'أنا حاسس إن في ضيق في النفس بقاله أسبوعين. ممكن تحكيلي هل الضيق بيزيد لما تتحرك؟',
  'AR',
);
assert(
  sanitizedGreeting === 'مش في أحسن حالي دكتور.',
  'greeting does not dump symptoms',
  sanitizedGreeting,
);
const sanitizedDoctorRole = sanitizeRealtimePatientTranscript(
  mockCase,
  'أول ساعات بيحصل كده',
  'تمام، قولي إيه بالظبط اللي بيحصل لما تتحرك شوية؟',
  'AR',
);
assert(
  sanitizedDoctorRole === 'مش فاهم قصدك دكتور.',
  'patient cannot ask doctor questions',
  sanitizedDoctorRole,
);

const ageKam = sanitizeRealtimePatientTranscript(mockCase, 'عندك كم سنة؟', '', 'AR');
assert(ageKam.includes('17'), 'عندك كم سنة returns age', ageKam);

const greetingAndName = sanitizeRealtimePatientTranscript(
  mockCase,
  'السلام عليكم ايه الاخبار اسمك ايه',
  'مش في أحسن حالي دكتور.',
  'AR',
);
assert(/اسمي\s+طارق/i.test(greetingAndName), 'combined greeting+name answers name', greetingAndName);

const priorDoctor = sanitizeRealtimePatientTranscript(mockCase, 'روحت للدكتور قبل كده؟', '', 'AR');
assert(priorDoctor.length > 5, 'prior doctor visit answered', priorDoctor);

const residence = sanitizeRealtimePatientTranscript(mockCase, 'أنت ساكن فين؟', '', 'AR');
assert(/شبرا/i.test(residence), 'residence answered', residence);

const complaintBetashtaki = sanitizeRealtimePatientTranscript(
  mockCase,
  'إيه الحاجة اللي بتشتكي منها؟',
  '',
  'AR',
);
assert(/ضيق نفس|تنفس|مجهود/i.test(complaintBetashtaki), 'بتشتكي complaint', complaintBetashtaki);

const complaintWadegiti = sanitizeRealtimePatientTranscript(mockCase, 'وديجتي من إيه؟', '', 'AR');
assert(/ضيق نفس|تنفس|مجهود/i.test(complaintWadegiti), 'وديجتي complaint', complaintWadegiti);

assert(looksLikeSttHallucination('شكراً للمشاركة'), 'blocks shukran participation');
assert(looksLikeSttHallucination('اشتركوا في القناة'), 'blocks subscribe hallucination');
assert(looksLikeSttHallucination('ي نانسي كونكر'), 'blocks english garbage');
assert(!looksLikeSttHallucination('عندك كم سنة'), 'allows real question');
assert(containsWrongScriptForArabic('你好世界这是一个测试'), 'blocks chinese');
assert(!isValidArabicSessionTranscript('你好世界', true), 'invalid chinese session transcript');
assert(isValidArabicSessionTranscript('عندك كم سنة', true), 'valid arabic transcript');

console.log('\n=== Live OpenAI client_secrets test ===\n');
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
  console.log('  ⚠ SKIP live test — OPENAI_API_KEY not set');
} else {
  try {
    const ephemeral = await mintRealtimeClientSecret(apiKey, config);
    assert(typeof ephemeral === 'string' && ephemeral.length > 20, 'OpenAI client_secrets OK');
  } catch (err) {
    const detail = (err as { detail?: string })?.detail || String(err);
    assert(false, 'OpenAI client_secrets', detail.slice(0, 200));
  }
}

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) process.exit(1);
console.log('\nAll realtime tests passed.\n');
