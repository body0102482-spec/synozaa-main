process.env.AI_PROVIDER = 'mock';
const { debugSplitVivaPoints, getManeuverExaminerResponse } = await import('../src/services/aiService.js');

const sample =
  'General: Middle-aged male, fully conscious, cooperative. Mild periorbital puffiness is visible bilaterally. No pallor, icterus, or cyanosis. Neck: Supple, neck veins (JVP) are normal and not elevated (estimated at 2 cm above sternal angle at 45 degrees, ruling out right heart failure). Legs: Massive, symmetrical bilateral swelling extending from the dorsum of both feet up to the mid-thighs. The skin over the swollen area is smooth, pale, stretched, and shiny. No localized redness, pigmentation, or varicose veins.';

console.log('POINTS:');
debugSplitVivaPoints(sample).forEach((p, i) => console.log(`${i + 1}. ${p}`));

const caseData = {
  id: 'o',
  titleEn: 'Oedema',
  titleAr: '',
  finalDiagnosis: 'Oedema',
  categoryId: null,
  stationConfig: null,
  physicalExam: JSON.stringify({ inspection: sample }),
} as any;

const hist: { role: string; content: string }[] = [];
const answers = [
  'puffy eyes',
  'No pallor, icterus, or cyanosis',
  'JVP is normal',
  'there is lower limb edema',
  'skin is smooth pale stretched and shiny',
  'no localized redness pigmentation or varicose veins',
];

for (const a of answers) {
  const r = await getManeuverExaminerResponse(caseData, 'inspection', a, hist, 'AR');
  hist.push({ role: 'STUDENT', content: a });
  hist.push({ role: 'EXAMINER', content: r });
  console.log('\n>>', a);
  console.log(r);
}
