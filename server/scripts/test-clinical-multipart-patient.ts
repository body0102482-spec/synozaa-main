process.env.AI_PROVIDER = 'mock';

const { getPatientResponse } = await import('../src/services/aiService.js');

const asMrCase = {
  id: 'as-mr',
  titleEn: 'AS + MR',
  titleAr: 'AS + MR',
  finalDiagnosis: 'AS + MR',
  categoryId: null,
  patientName: 'Tarek Moustafa El-Haddad',
  patientAge: 17,
  patientGender: 'Male',
  patientNationality: 'Egyptian',
  chiefComplaint: 'Shortness of breath of 2-week duration.',
  medicalHistory:
    'Progressive exertional dyspnea for 5 years (gradual onset, worse on exertion, relieved by rest). Paroxysmal nocturnal dyspnea — wakes gasping after ~2 hours of sleep, sleeps on 2 pillows. Lightheadedness and blurred vision on exertion. Productive cough with dark yellow sputum (~1/4 cup). High-grade fever 2 weeks ago with painful tonsillitis. Child-onset bronchial asthma with repeated tonsillitis (4–5/year). Rheumatic fever diagnosed 5 years ago (Jones criteria; steroids and aspirin with temporary improvement). Denies hemoptysis, weight loss, syncope, chest pain, cyanosis, edema, ascites, or pressure symptoms.',
  medicationHistory:
    'Depot penicillin IM every 15 days (prophylaxis). Inhaled Ventolin (salbutamol) for asthma. Occasional home oxygen for asthma attacks.',
  surgicalHistory: 'None',
  familyHistory: 'No similar illness.',
  socialHistory: 'Single 17-year-old male from Shobra Al-Kheima, Cairo. Non-smoker.',
  patientPersonality: 'Cooperative',
  scenarioPrompt: '',
} as any;

const dcmCase = {
  ...asMrCase,
  id: 'dcm',
  patientName: 'Samira Abdel Rahman',
  patientAge: 58,
  patientGender: 'Female',
  chiefComplaint: 'Progressive shortness of breath and ankle swelling for 3 weeks, worse when lying flat.',
  medicalHistory: 'Hypertension for 10 years. Type 2 diabetes. No known coronary artery disease. No rheumatic fever.',
  medicationHistory: 'Amlodipine 5mg daily, Metformin 500mg twice daily. Poor adherence reported.',
  familyHistory: 'Father died of heart failure at age 62. Sister has hypertension.',
} as any;

const tests = [
  {
    name: 'AS/MR onset + exertion + PND/orthopnea',
    caseData: asMrCase,
    q: 'الأعراض بدأت إمتى؟ هل ضيق النفس بيزيد مع المجهود؟ وهل بتصحى من النوم بسبب ضيق النفس أو محتاج تنام على أكتر من مخدة؟',
    checks: [/2\s*أسبوع|أسبوعين|أسابيع/i, /مجهود/i, /مخنوق|مخد/i],
  },
  {
    name: 'AS/MR edema + meds + HTN + DM',
    caseData: asMrCase,
    q: 'عندك تورم في الرجلين؟ بتاخد أدوية إيه؟ وعندك ضغط أو سكر؟',
    checks: [/تورم/i, /بنسلين|فنتولين/i, /ضغط/i, /سكر/i],
  },
  {
    name: 'DCM edema + meds + HTN + DM',
    caseData: dcmCase,
    q: 'عندك تورم في الرجلين؟ بتاخدي أدوية إيه؟ وعندك ضغط أو سكر؟',
    checks: [/تورم/i, /أملوديبين|ميتفورمين/i, /ضغط/i, /سكر/i],
  },
];

let failed = 0;
for (const test of tests) {
  const reply = await getPatientResponse(test.caseData, [], test.q, 'AR');
  console.log(`\n=== ${test.name} ===`);
  console.log(reply);
  for (const re of test.checks) {
    const ok = re.test(reply);
    console.log(`${ok ? 'OK' : 'MISSING'} ${re}`);
    if (!ok) failed += 1;
  }
}

if (failed > 0) {
  console.error(`\nFAILED: ${failed} expected clinical elements were missing.`);
  process.exit(1);
}

console.log('\nALL CLINICAL MULTI-PART TESTS PASSED');