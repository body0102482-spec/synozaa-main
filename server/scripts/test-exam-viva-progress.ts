/**
 * Examination viva progressive scoring checks (no DB).
 * Run: npx tsx scripts/test-exam-viva-progress.ts
 */
process.env.AI_PROVIDER = 'mock';

const { getManeuverExaminerResponse } = await import('../src/services/aiService.js');

const ascites = {
  id: 'ascites',
  titleEn: 'Ascites',
  titleAr: 'Ascites',
  finalDiagnosis: 'Ascites',
  categoryId: null,
  stationConfig: null,
  physicalExam: JSON.stringify({
    inspection:
      'Abdomen: Symetrically distended abdomen with full flanks and an everted umbilicus. Extremities: Bilateral pitting lower limb edema. Hands: Palmar erythema and leukonychia are visible. Eyes: Mild scleral icterus (jaundice).',
  }),
} as any;

const oedema = {
  id: 'oedema',
  titleEn: 'Oedema',
  titleAr: 'Oedema',
  finalDiagnosis: 'Oedema',
  categoryId: null,
  stationConfig: null,
  physicalExam: JSON.stringify({
    inspection:
      'General: Middle-aged male, fully conscious, cooperative. Mild periorbital puffiness is visible bilaterally. No pallor, icterus, or cyanosis. Neck: Supple, neck veins (JVP) are normal and not elevated (estimated at 2 cm above sternal angle at 45 degrees, ruling out right heart failure). Legs: Massive, symmetrical bilateral swelling extending from the dorsum of both feet up to the mid-thighs. The skin over the swollen area is smooth, pale, stretched, and shiny. No localized redness, pigmentation, or varicose veins.',
  }),
} as any;

const asmr = {
  id: 'asmr',
  titleEn: 'AS + MR',
  titleAr: 'AS + MR',
  finalDiagnosis: 'AS + MR',
  categoryId: null,
  stationConfig: null,
  physicalExam: JSON.stringify({
    inspection:
      'Chest Inspection: Evident linear hyperpigmented scar from a previous chest tube insertion in the left mid-axillary line. There is absolutely no precordial bulge, no dilated collateral superficial veins, and no skin lesions.',
  }),
} as any;

async function turn(
  caseData: any,
  answer: string,
  history: { role: string; content: string }[],
) {
  const reply = await getManeuverExaminerResponse(caseData, 'inspection', answer, history, 'EN');
  history.push({ role: 'STUDENT', content: answer });
  history.push({ role: 'ASSISTANT', content: reply });
  console.log(`\nSTUDENT: ${answer}`);
  console.log(`EXAMINER: ${reply}`);
  return reply;
}

console.log('===== AS + MR (good video style) =====');
{
  const h: { role: string; content: string }[] = [];
  await turn(asmr, "it's in the left side", h);
  await turn(asmr, 'normal chest wall no dilated veins', h);
  await turn(asmr, 'no precordial bulge', h);
}

console.log('\n===== Ascites progressive =====');
{
  const h: { role: string; content: string }[] = [];
  await turn(ascites, 'distension of the abdomen with everted umbilicus', h);
  await turn(ascites, 'full flanks', h);
  await turn(ascites, 'there is lower limb edema', h);
  const stuck = await turn(ascites, 'normal chest wall no dilated veins no scars', h);
  if (/You've mentioned/.test(stuck) && /still \d+ expected/.test(stuck)) {
    console.error('FAIL: stuck praise reply on unmatched finding');
    process.exitCode = 1;
  }
  await turn(ascites, 'palmar erythema and leukonychia', h);
  await turn(ascites, 'scleral icterus jaundice', h);
}

console.log('\n===== Oedema progressive (no stuck reply) =====');
{
  const h: { role: string; content: string }[] = [];
  const r1 = await turn(oedema, 'distension of the abdomen with everted umbilicus', h);
  const r2 = await turn(oedema, 'there is lower limb edema', h);
  const r3 = await turn(oedema, 'puffy eyes', h);
  if (r1 === r2 && r2 === r3) {
    console.error('FAIL: identical fixed replies across different answers');
    process.exitCode = 1;
  }
  await turn(oedema, 'no pallor no cyanosis', h);
  await turn(oedema, 'JVP is normal', h);
}
