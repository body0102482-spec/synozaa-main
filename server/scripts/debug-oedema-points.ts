/**
 * Debug which Oedema inspection points remain unmatched.
 * Run: npx tsx scripts/debug-oedema-points.ts
 */
process.env.AI_PROVIDER = 'mock';

// Re-implement scoring by calling getManeuverExaminerResponse stepwise,
// and also dump split points via a tiny inline copy imported from source.
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

const sample =
  'General: Middle-aged male, fully conscious, cooperative. Mild periorbital puffiness is visible bilaterally. No pallor, icterus, or cyanosis. Neck: Supple, neck veins (JVP) are normal and not elevated (estimated at 2 cm above sternal angle at 45 degrees, ruling out right heart failure). Legs: Massive, symmetrical bilateral swelling extending from the dorsum of both feet up to the mid-thighs. The skin over the swollen area is smooth, pale, stretched, and shiny. No localized redness, pigmentation, or varicose veins.';

const { getManeuverExaminerResponse } = await import('../src/services/aiService.js');

// Monkey: evaluate by probing coverage via sequential answers and reading feedback counts
const caseData = {
  id: 'oedema',
  titleEn: 'Oedema',
  titleAr: 'Oedema',
  finalDiagnosis: 'Oedema',
  categoryId: null,
  stationConfig: null,
  physicalExam: JSON.stringify({ inspection: sample }),
} as any;

const attempts = [
  'puffy eyes',
  'there is lower limb edema',
  'no pallor no cyanosis no jaundice',
  'JVP is normal',
  'skin is smooth pale stretched and shiny',
  'no redness no varicose veins',
  'No pallor or cyanosis or jaundice',
  'neck veins are normal',
  'smooth pale stretched shiny skin',
  'no localized redness pigmentation or varicose veins',
];

const history: { role: string; content: string }[] = [];
for (const a of attempts) {
  const reply = await getManeuverExaminerResponse(caseData, 'inspection', a, history, 'EN');
  history.push({ role: 'STUDENT', content: a });
  history.push({ role: 'ASSISTANT', content: reply });
  console.log('\n>>', a);
  console.log(reply);
}
