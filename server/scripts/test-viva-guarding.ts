process.env.AI_PROVIDER = 'mock';

const { evaluateHistoryVivaAnswer } = await import('../src/services/aiService.js');

const sample = `**Guarding:** Localized muscle contraction.
**Rigidity:** Diffuse contraction (Peritonitis, classically "board-like rigidity" in perforated peptic ulcer).
**Rebound tenderness:** Pain on release.`;

const caseData = {
  id: 'peptic',
  titleEn: 'Peptic Ulcer',
  titleAr: 'قرحة',
  finalDiagnosis: 'PUD',
  categoryId: null,
} as any;

const q = "What is the difference between 'guarding, rigidity, and rebound tenderness'?";

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

await check('guarding only', 'Guarding is localized muscle contraction');
await check('guarding short', 'Guarding');
await check('guarding meaning', 'localized muscle contraction');
await check(
  'two points',
  'Rigidity is diffuse contraction',
  'Guarding is localized muscle contraction\nRigidity is diffuse contraction',
);
await check(
  'all three',
  'Rebound tenderness is pain on release',
  'Guarding is localized muscle contraction\nRigidity is diffuse contraction\nRebound tenderness is pain on release',
);
