/**
 * Quick local check for viva scoring (no DB).
 * Run: npx tsx scripts/test-viva-scoring.ts
 */
import { createRequire } from 'module';

// Import internals via dynamic eval of compiled helpers by re-implementing
// a thin harness that imports the public evaluate path isn't exported for
// split — so we duplicate the critical checks by importing from source through tsx.

async function main() {
  const mod = await import('../src/services/aiService.js');
  // evaluateHistoryVivaAnswer is async and needs case/settings — instead
  // exercise via a small exported test if available.
  void mod;
}

// Inline copy of the scoring helpers by importing the file and calling
// evaluateHistoryVivaAnswer with mock provider.

process.env.AI_PROVIDER = 'mock';

const { evaluateHistoryVivaAnswer } = await import('../src/services/aiService.js');

const sample =
  'The alarm symptoms include: dysphagia, odynophagia, persistent unexplained vomiting, unintentional weight loss, evidence of gastrointestinal bleed, epigastric mass, anemia.';

const caseData = {
  id: 'test',
  titleEn: 'GERD',
  titleAr: 'GERD',
  finalDiagnosis: 'GERD',
  categoryId: null,
} as any;

async function check(label: string, answer: string, combined?: string) {
  const result = await evaluateHistoryVivaAnswer(
    caseData,
    'What are the alarm symptoms?',
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

await check('single dysphagia', 'Dysphagia');
await check('vomiting+weight', 'unexplained vomiting and weight loss', 'Dysphagia\nunexplained vomiting and weight loss');
await check('epigastric new', 'epigastric mass', 'Dysphagia\nunexplained vomiting and weight loss\nepigastric mass');
await check(
  'list',
  'Dysphagia w odynophagia w persistent unexplained vomiting w unintentional weight loss',
);

console.log('\nDone.');
