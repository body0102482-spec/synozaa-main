process.env.AI_PROVIDER = 'mock';

const { getPatientResponse } = await import('../src/services/aiService.js');

const caseData = {
  id: 'as-mr',
  titleEn: 'AS + MR',
  titleAr: 'AS + MR',
  finalDiagnosis: 'AS + MR',
  categoryId: null,
  patientName: 'Tarek Moustafa El-Haddad',
  patientAge: 17,
  patientGender: 'Male',
  patientNationality: 'Egyptian',
  chiefComplaint: 'Progressive exertional dyspnea and occasional chest tightness for 6 months.',
  medicalHistory: 'Recurrent tonsillitis in childhood.',
  medicationHistory: 'None',
  surgicalHistory: 'None',
  familyHistory: 'No similar illness.',
  socialHistory: 'From Shobra El-Kheima. Non-smoker, no alcohol. Plays football. Unmarried.',
  patientPersonality: 'Cooperative',
  scenarioPrompt: '',
} as any;

const q =
  'قولي اسمك وسنك وساكن فين واتولدت فين ومتجوز ولا لا وبتدخن ولا تشرب وايه اللي بتشتكي منه والحكاية بدأت ازاي وكرة القدم';

const reply = await getPatientResponse(caseData, [], q, 'AR');
console.log('REPLY:\n', reply);
console.log('---');
for (const [label, re] of [
  ['name', /طارق|اسمي/i],
  ['age', /17/],
  ['residence', /شبرا/i],
  ['marital', /متجوز/i],
  ['habits', /دخن|شرب/i],
  ['complaint', /نفس|ضيق|صدر|تعب/i],
  ['football', /كرة/i],
] as const) {
  console.log(label, re.test(reply) ? 'OK' : 'MISSING');
}
