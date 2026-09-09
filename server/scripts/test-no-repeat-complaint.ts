process.env.AI_PROVIDER = 'mock';

const { getPatientResponse } = await import('../src/services/aiService.js');

const caseData = {
  id: 'bilharzia',
  titleEn: 'Bilharziasis',
  titleAr: 'بلهارسيا',
  finalDiagnosis: 'Schistosomiasis',
  categoryId: null,
  patientName: 'Mansour Hegazi',
  patientAge: 55,
  patientGender: 'Male',
  patientNationality: 'Egyptian',
  chiefComplaint: 'Terminal hematuria and dysuria for 6 months.',
  medicalHistory: 'Works in irrigation canals. Recurrent urinary symptoms.',
  medicationHistory: 'None',
  surgicalHistory: 'None',
  familyHistory: 'None',
  socialHistory: 'Farmer from rural Delta. Non-smoker.',
  patientPersonality: 'Anxious',
  scenarioPrompt: '',
} as any;

async function turn(msg: string, history: { role: string; content: string }[]) {
  const reply = await getPatientResponse(caseData, history, msg, 'AR');
  history.push({ role: 'STUDENT', content: msg });
  history.push({ role: 'PATIENT', content: reply });
  console.log('Q:', msg);
  console.log('A:', reply);
  console.log('---');
  return reply;
}

const history: { role: string; content: string }[] = [];
await turn('الحاجة ايه الاخبار مالك', history);
const a2 = await turn('ليه بس ايه اللي حصل لك او حاسه بايه', history);
const a3 = await turn('الشكوى بالظبط بتحسي بايه', history);
const a4 = await turn('ايوه الشكوى عباره عن ايه اللي تعبك', history);

console.log('a2==a3', a2 === a3);
console.log('a3==a4', a3 === a4);
console.log('has hematuria/urine', /بول|دم|حرقان|تبول|hematuria/i.test(a2 + a3 + a4));
