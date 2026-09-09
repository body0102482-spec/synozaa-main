process.env.AI_PROVIDER = 'mock';

const { evaluateHistoryVivaAnswer } = await import('../src/services/aiService.js');

const sample =
  'The patient must lie flat and flex their knees to relax the abdominal muscles and the superficial fascia (since there is no deep fascia in the abdominal wall).';

const caseData = {
  id: 'pud',
  titleEn: 'Peptic Ulcer',
  titleAr: 'قرحة',
  finalDiagnosis: 'PUD',
  categoryId: null,
} as any;

const q =
  'Why do we "flex" the patient\'s lower limbs during palpation, and what is the ideal position?';

async function check(label: string, answer: string, combined?: string) {
  const result = await evaluateHistoryVivaAnswer(
    caseData,
    q,
    1,
    answer,
    sample,
    combined ?? answer,
  );
  console.log(`\n[${label}]`);
  console.log('  answer:', answer);
  console.log('  advance:', result.advance);
  console.log('  feedback:', result.feedback);
}

await check('1 knees', 'lie flat / flex the knees');
await check(
  '2 muscles',
  'to relax the abdominal muscles',
  'lie flat / flex the knees\nto relax the abdominal muscles',
);
await check(
  '3 fascia',
  'superficial fascia / no deep fascia in the abdominal wall',
  'lie flat / flex the knees\nto relax the abdominal muscles\nsuperficial fascia / no deep fascia in the abdominal wall',
);
await check('all at once', sample);
