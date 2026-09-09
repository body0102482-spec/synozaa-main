process.env.AI_PROVIDER = 'mock';

// Import via evaluating split by calling evaluate and also dumping points through a tiny harness.
const mod = await import('../src/services/aiService.js');

const sample =
  'The patient must lie flat and flex their knees to relax the abdominal muscles and the superficial fascia (since there is no deep fascia in the abdominal wall).';

// Re-implement split locally by reading source is hard — use evaluate stepwise with isolated answers.

const caseData = { id: 'pud', titleEn: 'PUD', titleAr: '', finalDiagnosis: 'PUD', categoryId: null } as any;
const q = 'Why flex?';

async function one(answer: string) {
  const r = await mod.evaluateHistoryVivaAnswer(caseData, q, 1, answer, sample, answer);
  console.log(JSON.stringify({ answer, advance: r.advance, feedback: r.feedback }));
}

await one('lie flat');
await one('flex the knees');
await one('relax the abdominal muscles');
await one('superficial fascia');
await one('no deep fascia in the abdominal wall');
await one('lie flat and flex knees');
