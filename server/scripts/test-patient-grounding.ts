/**
 * Focused deterministic patient-grounding regressions.
 * Run: npx tsx scripts/test-patient-grounding.ts
 */
process.env.AI_PROVIDER = 'mock';

const { getPatientResponse } = await import('../src/services/aiService.js');

const tarek = {
  id: 'tarek-grounding', titleEn: 'AS/MR', titleAr: 'AS/MR', finalDiagnosis: 'AS/MR', categoryId: null,
  patientName: 'Tarek Moustafa El-Haddad', patientAge: 17, patientGender: 'Male', patientNationality: 'Egyptian',
  patientBirthPlace: null, patientResidence: 'Shobra Al-Kheima, Cairo', patientOccupation: 'Apprentice house painter',
  patientMaritalStatus: 'Single', patientSmokingStatus: 'Non-smoker', patientAlcoholStatus: null,
  chiefComplaint: 'Shortness of breath of 2-week duration.',
  medicalHistory: 'Progressive exertional dyspnea for 5 years (gradual onset, worse on exertion, relieved by rest). Paroxysmal nocturnal dyspnea — wakes gasping after ~2 hours of sleep, sleeps on 2 pillows. Lightheadedness and blurred vision on exertion. Productive cough with dark yellow sputum (~1/4 cup). High-grade fever 2 weeks ago with painful tonsillitis. Denies hemoptysis, weight loss, syncope, chest pain, cyanosis, edema, ascites, or pressure symptoms.',
  medicationHistory: 'Depot penicillin IM every 15 days.', surgicalHistory: 'None', familyHistory: 'No similar illness.',
  socialHistory: 'Single 17-year-old male from Shobra Al-Kheima, Cairo. Non-smoker.', patientPersonality: 'Cooperative', scenarioPrompt: '',
} as any;

const samira = {
  ...tarek,
  id: 'samira-grounding', patientName: 'Samira Abdel Rahman', patientAge: 58, patientGender: 'Female',
  patientBirthPlace: null, patientResidence: null, patientOccupation: 'Retired teacher', patientMaritalStatus: null,
  patientSmokingStatus: 'Former smoker, quit 5 years ago', patientAlcoholStatus: null,
  chiefComplaint: 'Progressive shortness of breath and ankle swelling for 3 weeks, worse when lying flat.',
  medicalHistory: 'Hypertension for 10 years. Type 2 diabetes. No known coronary artery disease. No rheumatic fever.',
  medicationHistory: 'Amlodipine 5mg daily, Metformin 500mg twice daily.',
  familyHistory: 'Father died of heart failure at age 62. Sister has hypertension.', socialHistory: 'Retired teacher. Former smoker.',
} as any;

const legacyExplicitFacts = {
  ...tarek,
  id: 'legacy-explicit-facts',
  patientBirthPlace: null,
  patientResidence: null,
  patientAlcoholStatus: null,
  socialHistory: 'Non-alcoholic. Non-smoker.',
  scenarioPrompt: 'Background biography: lives in Mansoura.',
} as any;

const residenceOnly = {
  ...legacyExplicitFacts,
  id: 'residence-only',
  socialHistory: 'Non-smoker.',
  scenarioPrompt: 'Background biography: lives in Mansoura.',
} as any;

const explicitBirthPlace = {
  ...residenceOnly,
  id: 'explicit-birthplace',
  scenarioPrompt: 'Background biography: born in Aswan.',
} as any;

let failed = 0;
async function check(name: string, caseData: any, question: string, matches: RegExp[], absent: RegExp[] = []) {
  const reply = await getPatientResponse(caseData, [], question, 'AR');
  const ok = matches.every((re) => re.test(reply)) && absent.every((re) => !re.test(reply));
  const missing = matches.filter((re) => !re.test(reply)).map(String);
  const unexpected = absent.filter((re) => re.test(reply)).map(String);
  console.log(`${ok ? '✓' : '✗'} ${name}: ${reply}${ok ? '' : ` (missing: ${missing.join(', ') || 'none'}; unexpected: ${unexpected.join(', ') || 'none'})`}`);
  if (!ok) failed++;
}

await check('Samira alcohol-only stays unknown and feminine', samira, 'بتشربي كحوليات؟', [/كحول/, /مش عارفة/], [/بدخن|مش بشرب/]);
await check('Explicit legacy non-alcoholic is grounded as no alcohol', legacyExplicitFacts, 'بتشرب كحوليات؟', [/مش بشرب كحوليات/], [/مش عارف|مش متأكد/]);
await check('Explicit legacy residence is used when structured residence is empty', legacyExplicitFacts, 'ساكن فين؟', [/عايش في Mansoura/], [/مش متأكد|مش فاكر/]);
await check('Legacy birthplace is used only when an explicit born-in statement exists', explicitBirthPlace, 'اتولدت فين؟', [/اتولدت في Aswan/], [/مش متأكد|Mansoura/]);
await check('Residence is never reused as birthplace without explicit birth wording', residenceOnly, 'اتولدت فين؟', [/مكان الميلاد/, /مش متأكد/], [/Mansoura/]);
await check('Samira PND is unknown', samira, 'بتصحى من النوم مخنوقة؟', [/مش فاكرة/, /بيصحيني/], [/مخدات|آه/]);
await check('Samira orthopnea is positive', samira, 'النفس بيضايقك لما تنامي مفرودة؟', [/آه/, /مفرود/], [/مخدات/]);
await check(
  'Samira exact UI pillow-count question stays uncertain with no invented number',
  samira,
  'بتنامي على كام مخدة؟',
  [/مش فاكرة/, /مخد/],
  [/[0-9٠-٩]/, /مخدتين|اتنين|اثنين/],
);
await check('Samira cough is unknown', samira, 'عندك كحة أو بلغم؟', [/مش فاكرة/, /كحة|بلغم/], [/مفيش كحة/]);
await check('Samira rheumatic fever is not recent fever', samira, 'كان عندك سخونية قريب؟', [/مش فاكرة/, /السخونية/], [/سخونية عالية|آه/]);
await check('Tarek productive cough preserves sputum fact', tarek, 'عندك كحة؟', [/كحة ببلغم/, /أصفر غامق/]);
await check('Tarek exertional dizziness is positive', tarek, 'بيجيلك دوخة أو زغللة؟', [/آه/, /دوخة|زغللة/, /مجهود/]);
await check('Tarek recent fever is positive', tarek, 'كان عندك حرارة أو سخونية قريب؟', [/آه/, /سخونية عالية/]);
await check('Tarek PND is positive', tarek, 'بتصحى من النوم مخنوق؟', [/آه/, /2\s*ساعات/]);
await check('Tarek exact UI pillow-count question preserves explicit count', tarek, 'بتنام على كام مخدة؟', [/2\s*مخد/]);
await check('Drug allergy does not return medication list', samira, 'عندك حساسية من دوا؟', [/مش فاكرة/, /حساسية/], [/أملوديبين|ميتفورمين/]);
await check('Family hypertension is not claimed as same disease', samira, 'حد في العيلة عنده نفس المشكلة؟', [/مش فاكرة/, /نفس المشكلة/], [/عنده ضغط/]);
await check('Arabic multi-demographics answers every detected fact', samira,
  'اسمك ايه، عندك كام سنة، ساكنة فين، بتشتغلي ايه، متجوزة، بتدخني ولا بتشربي كحول؟',
  [/اسمي/, /58/, /متقاعدة/, /ماعنديش معلومة مؤكدة/, /كنت بدخن وبطلت/, /الكحول.*مش عارفة/],
);

const clientCombinedQuestion = 'اسمك اي و عندك كام سنة و مولود و عايش فين و شغال اي و متجوز ولا اي و بتشرب سجاير او كحوليات و بتشتكي من اي';
const tarekCombinedReply = await getPatientResponse(tarek, [], clientCombinedQuestion, 'AR');
const orderTokens = [
  /اسمي/, /17 سنة/, /مكان الميلاد/, /شبرا الخيمة، القاهرة/, /نقاش/, /مش متجوز/, /مش بدخن/, /كحول/, /ضيق نفس/,
];
const orderPositions = orderTokens.map((token) => tarekCombinedReply.search(token));
const inQuestionOrder = orderPositions.every((position, index) => position >= 0 && (index === 0 || position > orderPositions[index - 1]));
console.log(`${inQuestionOrder ? '✓' : '✗'} Tarek exact client combined question preserves answer order: ${tarekCombinedReply}`);
if (!inQuestionOrder) failed++;
const leakedHistory = /مجهود|مخنوق|مخد|دوخة|زغللة|كحة|بلغم|سخونية/i.test(tarekCombinedReply);
console.log(`${!leakedHistory ? '✓' : '✗'} Tarek combined complaint stays brief: ${tarekCombinedReply}`);
if (leakedHistory) failed++;
const tarekNaturalUnknowns =
  /مش متأكد من مكان الميلاد/.test(tarekCombinedReply) &&
  /الكحوليات.*مش عارف أقولك حاجة مؤكدة/.test(tarekCombinedReply) &&
  !/مش فاكر بالظبط/.test(tarekCombinedReply);
console.log(`${tarekNaturalUnknowns ? '✓' : '✗'} Tarek combined demographics use non-robotic uncertainty: ${tarekCombinedReply}`);
if (!tarekNaturalUnknowns) failed++;

const samiraCombinedReply = await getPatientResponse(samira, [], clientCombinedQuestion, 'AR');
const feminineNaturalDemographicUncertainty =
  /مش متأكدة من مكان الميلاد/.test(samiraCombinedReply) &&
  /موضوع السكن مش متأكدة منه/.test(samiraCombinedReply) &&
  /ماعنديش معلومة مؤكدة/.test(samiraCombinedReply) &&
  /الكحوليات.*مش عارفة أقولك حاجة مؤكدة/.test(samiraCombinedReply) &&
  !/مش فاكر(?:ة)? بالظبط/.test(samiraCombinedReply) &&
  !/مش متأكد(?!ة) من|مش عارف(?!ة) أأكد/.test(samiraCombinedReply);
console.log(`${feminineNaturalDemographicUncertainty ? '✓' : '✗'} Samira combined demographics use feminine, non-robotic uncertainty: ${samiraCombinedReply}`);
if (!feminineNaturalDemographicUncertainty) failed++;

await check('Tarek unknown birthplace stays natural and masculine', tarek, 'اتولدت فين؟', [/مش متأكد/, /مكان الميلاد/], [/مش فاكرة|مش متأكدة/]);
await check('Samira unknown birthplace stays natural and feminine', samira, 'اتولدتي فين؟', [/مش متأكدة/, /مكان الميلاد/], [/مش فاكر|مش متأكد(?!ة)/]);
await check('Samira unknown residence stays natural and feminine', samira, 'ساكنة فين؟', [/السكن/, /مش متأكدة/], [/مش فاكر|مش متأكد(?!ة)/]);

await check(
  'Tarek initial open complaint is brief and does not leak history',
  tarek,
  'بتشتكي من اي؟',
  [/ضيق نفس/],
  [/مجهود|مخنوق|مخد|دوخة|زغللة|كحة|بلغم|سخونية/],
);
await check(
  'Arabic two-week chief complaint uses natural أسبوعين wording',
  tarek,
  'بتشتكي من اي؟',
  [/أسبوعين/, /ضيق نفس/],
  [/2\s*أسابيع/],
);
await check(
  'Tarek explicit complaint detail can be richer and grounded',
  tarek,
  'احكيلي أكتر عن ضيق النفس',
  [/مجهود|مخنوق|مخد|دوخة|زغللة/],
);
await check(
  'Samira initial open complaint stays brief and grounded',
  samira,
  'ايه اللي تعبك؟',
  [/ضيق نفس/],
  [/مخدات|كحة|سخونية|مخنوق/],
);

if (failed) {
  console.error(`\n${failed} grounding regression(s) failed.`);
  process.exit(1);
}
console.log('\nAll patient grounding regressions passed.');
