/**
 * Patient realism / intent tests for text chat.
 * Run: npx tsx scripts/test-patient-realism.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Case } from '@prisma/client';
import {
  getPatientResponse,
  sanitizeRealtimePatientTranscript,
} from '../src/services/aiService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const samiraCase = {
  patientName: 'Samira Abdel Rahman',
  patientAge: 58,
  patientGender: 'Female',
  patientNationality: 'Egyptian',
  chiefComplaint: 'Progressive shortness of breath and ankle swelling for 3 weeks, worse when lying flat.',
  medicalHistory: 'Hypertension for 10 years. Type 2 diabetes.',
  medicationHistory: 'Amlodipine 5mg daily',
  surgicalHistory: 'No previous cardiac surgery.',
  familyHistory: 'Father died of heart failure at age 62.',
  socialHistory: 'Retired teacher. Former smoker.',
  patientPersonality: 'Anxious older woman, breathless when speaking.',
  scenarioPrompt: '58-year-old with breathlessness and ankle swelling for 3 weeks.',
  finalDiagnosis: 'Acute decompensated heart failure',
  categoryId: null,
} as Case;

const tarekCase = {
  ...samiraCase,
  patientName: 'Tarek Moustafa El-Haddad',
  patientAge: 17,
  patientGender: 'Male',
  chiefComplaint: 'Shortness of breath of 2-week duration.',
  medicalHistory: 'Progressive exertional dyspnea. Paroxysmal nocturnal dyspnea — wakes gasping after ~2 hours of sleep, sleeps on 2 pillows. Productive cough and recent fever.',
  socialHistory: 'Single 17-year-old male. Apprentice house painter. Non-smoker.',
  patientPersonality: 'Cooperative adolescent male patient.',
} as Case;

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

console.log('\n=== Patient realism (mock provider) ===\n');
process.env.AI_PROVIDER = 'mock';

const greeting = await getPatientResponse(samiraCase, [], 'اهلا', 'AR');
assert(/أهلاً|اهلا|السلام|صباح|مساء/i.test(greeting), 'greeting stays warm without dumping symptoms', greeting);

const wellbeing = await getPatientResponse(samiraCase, [{ role: 'STUDENT', content: 'اهلا' }], 'عامل أي', 'AR');
assert(/تعبان|مش في أحسن حالي|والله/i.test(wellbeing), 'wellbeing is natural not one word', wellbeing);

const complaint = await getPatientResponse(
  samiraCase,
  [{ role: 'STUDENT', content: 'اهلا' }],
  'بتشتكي من أي',
  'AR',
);
assert(/تنفس|نفس|تعبان|أسابيع|تورم/i.test(complaint), 'truncated complaint question answered', complaint);

const vague = await getPatientResponse(samiraCase, [], 'أيه', 'AR');
assert(/مش فاهم|توضّح/i.test(vague), 'vague أيه asks to clarify', vague);

const helo = await getPatientResponse(samiraCase, [], 'هيلو', 'AR');
assert(!/مش فاهم|توضّح/i.test(helo), 'هيلو is greeting not clarify', helo);

const amelEh = await getPatientResponse(
  samiraCase,
  [{ role: 'STUDENT', content: 'هيلو' }],
  'عامل ايه',
  'AR',
);
assert(/تعبان|مش في أحسن حالي|والله/i.test(amelEh), 'عامل ايه wellbeing reply', amelEh);

const empathy = await getPatientResponse(samiraCase, [], 'الف مليون سلامة عليك', 'AR');
assert(/الله يسلمك|تسلم/i.test(empathy), 'empathy gets warm reply', empathy);

const empathyStt = await getPatientResponse(samiraCase, [], 'الف سلامه', 'AR');
assert(/الله يسلمك|تسلم/i.test(empathyStt), 'STT الف سلامه empathy', empathyStt);

const clinicalLeak = /ضيق|نفس|أسبوع|مجهود|مخنوق|مخد|سخون|كحة|اسمي/i;
const tarekTurkishSeries = await getPatientResponse(tarekCase, [], 'بتتفرج على مسلسلات تركية ولا مش متابع؟', 'AR');
assert(/مش بتابع المسلسلات/i.test(tarekTurkishSeries), 'Tarek Turkish-series question gets a natural male casual reply', tarekTurkishSeries);
assert(!clinicalLeak.test(tarekTurkishSeries) && !/مش متابعة|مش قادرة/i.test(tarekTurkishSeries), 'Tarek casual reply has no clinical dump or feminine grammar', tarekTurkishSeries);

const tarekPlayer = await getPatientResponse(tarekCase, [], 'مين لاعبك المفضل؟', 'AR');
assert(/مليش لاعب مفضل/i.test(tarekPlayer), 'Tarek favorite-player question does not invent a player', tarekPlayer);
assert(!clinicalLeak.test(tarekPlayer) && !/صلاح|ميسي|مش متابعة|مش قادرة/i.test(tarekPlayer), 'Tarek player reply is non-clinical and masculine', tarekPlayer);

const authoredPreference = await getPatientResponse(
  { ...tarekCase, scenarioPrompt: 'لاعب المفضل هو محمد صلاح.' } as Case,
  [],
  'مين لاعبك المفضل؟',
  'AR',
);
assert(/محمد صلاح/.test(authoredPreference), 'an explicitly authored personal preference is used without inference', authoredPreference);

const repeatedTarekPlayer = await getPatientResponse(
  tarekCase,
  [{ role: 'STUDENT', content: 'مين لاعبك المفضل؟' }, { role: 'PATIENT', content: tarekPlayer }],
  'مين لاعبك المفضل؟',
  'AR',
);
assert(!clinicalLeak.test(repeatedTarekPlayer), 'repeated casual question never falls back to a clinical filler', repeatedTarekPlayer);

const samiraTurkishSeries = await getPatientResponse(samiraCase, [], 'بتتفرجي على مسلسلات تركية ولا مش متابعة؟', 'AR');
assert(/مش متابعة المسلسلات/i.test(samiraTurkishSeries), 'Samira Turkish-series question gets feminine casual grammar', samiraTurkishSeries);
assert(!clinicalLeak.test(samiraTurkishSeries) && !/مش متابع(?!ة)|مش قادر/i.test(samiraTurkishSeries), 'Samira casual reply has no clinical dump or masculine grammar', samiraTurkishSeries);

const samiraPlayer = await getPatientResponse(samiraCase, [], 'مين لاعبك المفضل؟', 'AR');
assert(/مليش لاعب مفضل/i.test(samiraPlayer), 'Samira favorite-player question does not invent a player', samiraPlayer);
assert(!clinicalLeak.test(samiraPlayer) && !/صلاح|ميسي/.test(samiraPlayer), 'Samira player reply stays non-clinical and non-invented', samiraPlayer);

const socialQuestionWithLike = await getPatientResponse(samiraCase, [], 'بتحبي تشربي كحوليات؟', 'AR');
assert(/كحوليات/.test(socialQuestionWithLike) && !/تفضيل|مسلسلات|لاعب|هواية/.test(socialQuestionWithLike), 'smoking/alcohol phrased conversationally remains clinical history', socialQuestionWithLike);

const clinicalAfterCasual = await getPatientResponse(tarekCase, [{ role: 'STUDENT', content: 'مين لاعبك المفضل؟' }], 'بتشتكي من اي؟', 'AR');
assert(/ضيق نفس/.test(clinicalAfterCasual), 'a clinical question immediately after casual talk still routes to the complaint', clinicalAfterCasual);

const realUiSequenceHistory: Array<{ role: string; content: string }> = [];
for (const question of [
  'مين لاعبك المفضل؟',
  'بتتفرج على مسلسلات تركية ولا مش متابع؟',
  'اسمك اي و عندك كام سنة و مولود و عايش فين و شغال اي و متجوز ولا اي و بتشرب سجاير او كحوليات و بتشتكي من اي',
]) {
  const answer = await getPatientResponse(tarekCase, realUiSequenceHistory, question, 'AR');
  realUiSequenceHistory.push({ role: 'STUDENT', content: question }, { role: 'PATIENT', content: answer });
}
const standaloneComplaintAfterSequence = await getPatientResponse(
  tarekCase,
  realUiSequenceHistory,
  'بتشتكي من اي؟',
  'AR',
);
assert(/من أسبوعين بحس بضيق نفس/.test(standaloneComplaintAfterSequence), 'standalone open complaint stays concise after casual and demographic turns', standaloneComplaintAfterSequence);
assert(!/مجهود|راحة|مخنوق|مخد|كحة|بلغم|سخون|دوخة|زغللة/.test(standaloneComplaintAfterSequence), 'standalone complaint after sequence does not leak the HPI', standaloneComplaintAfterSequence);
realUiSequenceHistory.push({ role: 'STUDENT', content: 'بتشتكي من اي؟' }, { role: 'PATIENT', content: standaloneComplaintAfterSequence });
const pndAfterSequence = await getPatientResponse(tarekCase, realUiSequenceHistory, 'بتصحى من النوم مخنوق؟', 'AR');
assert(/آه/.test(pndAfterSequence) && /مخنوق/.test(pndAfterSequence) && /2\s*ساعات/.test(pndAfterSequence), 'PND follow-up remains detailed and grounded after concise complaint', pndAfterSequence);

console.log('\n=== Egyptian Arabic semantic-intent variants ===\n');
const semanticTarek = {
  ...tarekCase,
  patientBirthPlace: 'Shobra Al-Kheima, Cairo',
  patientResidence: 'Shobra Al-Kheima, Cairo',
  patientOccupation: 'Apprentice house painter',
  patientMaritalStatus: 'Single',
  patientSmokingStatus: 'Non-smoker',
  patientAlcoholStatus: 'Non-alcoholic',
} as Case;
const semanticSamira = {
  ...samiraCase,
  patientResidence: 'Cairo',
  patientOccupation: 'Retired teacher',
  patientMaritalStatus: 'Single',
  patientSmokingStatus: 'Non-smoker',
  patientAlcoholStatus: 'Non-alcoholic',
} as Case;

for (const question of ['انت مولود فين؟', 'مولود فين؟', 'اتولدت فين؟', 'مكان ميلادك فين؟', 'فين اتولدت يا عم؟']) {
  const answer = await getPatientResponse(semanticTarek, [], question, 'AR');
  assert(/اتولدت في شبرا الخيمة، القاهرة/.test(answer), `birthplace variant is grounded: ${question}`, answer);
}
for (const question of ['عايش فين؟', 'ساكن فين؟', 'مقيم فين دلوقتي؟']) {
  const answer = await getPatientResponse(semanticSamira, [], question, 'AR');
  assert(/عايشة? في (?:Cairo|القاهرة)/.test(answer), `residence variant is grounded: ${question}`, answer);
}
for (const question of ['شغال ايه؟', 'بتشتغل ايه؟', 'بتعمل ايه في حياتك؟']) {
  const answer = await getPatientResponse(semanticTarek, [], question, 'AR');
  assert(/بشتغل.*(?:دهان|نقاش)/.test(answer), `occupation variant is grounded: ${question}`, answer);
}
for (const question of ['متجوز؟', 'متزوج ولا سنجل؟', 'يا دكتور انت سنجل؟']) {
  const answer = await getPatientResponse(semanticTarek, [], question, 'AR');
  assert(/مش متجوز/.test(answer), `marital variant is grounded: ${question}`, answer);
}
for (const question of ['بتدخن؟', 'بتشرب سجاير؟', 'ليك في السجاير؟']) {
  const answer = await getPatientResponse(semanticTarek, [], question, 'AR');
  assert(/مش بدخن/.test(answer), `smoking variant is grounded: ${question}`, answer);
}
for (const question of ['بتشرب كحوليات؟', 'بتشرب خمرة؟', 'ليك في الشرب؟']) {
  const answer = await getPatientResponse(semanticTarek, [], question, 'AR');
  assert(/مش بشرب كحوليات/.test(answer), `alcohol variant is grounded: ${question}`, answer);
}
for (const question of ['بتشتكي من اي؟', 'ايه اللي مضايقك؟', 'مالك؟', 'جاي النهاردة بسبب ايه؟']) {
  const answer = await getPatientResponse(semanticTarek, [], question, 'AR');
  assert(/ضيق نفس/.test(answer) && !/مخد|كحة|سخون|مجهود/.test(answer), `open complaint variant stays brief: ${question}`, answer);
}
for (const question of ['بتصحى من النوم مخنوق؟', 'النفس بيصحّيك من النوم؟', 'بتقوم بالليل عشان مش قادر تتنفس؟']) {
  const answer = await getPatientResponse(semanticTarek, [], question, 'AR');
  assert(/مخنوق/.test(answer) && /2\s*ساعات/.test(answer), `PND variant remains grounded: ${question}`, answer);
}
for (const question of ['بتاخدي ايه؟', 'بتستعملي أدوية؟']) {
  const answer = await getPatientResponse(samiraCase, [], question, 'AR');
  assert(/أملوديبين/.test(answer), `medication variant is grounded: ${question}`, answer);
}
const unknownBirthplaceVariant = await getPatientResponse(semanticSamira, [], 'مكان ميلادك فين؟', 'AR');
assert(/مش متأكدة|مش فاكرة/.test(unknownBirthplaceVariant) && !/القاهرة/.test(unknownBirthplaceVariant), 'unknown birthplace stays unknown instead of borrowing residence', unknownBirthplaceVariant);
const semanticCasual = await getPatientResponse(semanticSamira, [], 'طب مين لاعبك المفضل بقى؟', 'AR');
assert(!clinicalLeak.test(semanticCasual) && !/صلاح|ميسي/.test(semanticCasual), 'casual filler wording stays non-clinical and non-invented', semanticCasual);

const femaleFatigueCase = { ...samiraCase, chiefComplaint: 'Fatigue for 2 weeks.' } as Case;
const femaleFatigue = await getPatientResponse(femaleFatigueCase, [], 'بتشتكي من اي؟', 'AR');
assert(/تعبانة ومش قادرة/.test(femaleFatigue), 'female clinical fallback keeps feminine self-reference', femaleFatigue);
const unknownOccupationFemale = await getPatientResponse(
  { ...samiraCase, patientOccupation: null, socialHistory: '', scenarioPrompt: '', patientPersonality: '' } as Case,
  [],
  'بتشتغلي ايه؟',
  'AR',
);
assert(/مش فاكرة/.test(unknownOccupationFemale) && !/مش فاكر(?!ة)/.test(unknownOccupationFemale), 'female unknown demographic fallback is feminine', unknownOccupationFemale);

const helloRepeat = await getPatientResponse(
  samiraCase,
  [{ role: 'STUDENT', content: 'الف سلامه' }],
  'اهلا اهلا',
  'AR',
);
assert(/أهلاً|اهلا/i.test(helloRepeat), 'اهلا اهلا gets greeting not clarify', helloRepeat);

const multiDemographics = await getPatientResponse(
  samiraCase,
  [{ role: 'STUDENT', content: 'اهلا' }],
  'اسمك ايه عندك كم سنه ساكن فين',
  'AR',
);
assert(/اسمي/i.test(multiDemographics), 'multi-question includes name', multiDemographics);
assert(/58|سنة/i.test(multiDemographics), 'multi-question includes age', multiDemographics);
assert(/القاهرة|شبرا|من/i.test(multiDemographics), 'multi-question includes residence', multiDemographics);

const mixedSocial = await getPatientResponse(
  samiraCase,
  [{ role: 'STUDENT', content: 'اهلا' }],
  'اسمك ايه عامل ايه عندك كم سنه',
  'AR',
);
assert(/اسمي/i.test(mixedSocial), 'mixed name+wellbeing+age includes name', mixedSocial);
assert(/58|سنة/i.test(mixedSocial), 'mixed name+wellbeing+age includes age', mixedSocial);
assert(
  /تعبان|مش في أحسن حالي|والله/i.test(mixedSocial),
  'mixed name+wellbeing+age includes wellbeing',
  mixedSocial,
);

console.log('\n=== Voice path stays brief ===\n');
const voiceWellbeing = sanitizeRealtimePatientTranscript(samiraCase, 'إيه الأخبار', 'long ai dump', 'AR');
assert(voiceWellbeing.length < 80, 'voice wellbeing stays short', voiceWellbeing);

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('\nAll patient realism tests passed.\n');
