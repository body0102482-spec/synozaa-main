/**
 * Client-acceptance scenarios for Examiner Box OSCE rules.
 * Run: npx tsx scripts/test-examiner-client-acceptance.ts
 *
 * Covers: intent, meaning vs keywords, wrong definitions, synonyms,
 * partial credit, give-up, order independence, extra correct info.
 */
import {
  debugEvaluateHistoryVivaLocal,
  debugScoreViva,
  detectVivaStudentIntent,
} from '../src/services/aiService.js';

const DYSPHAGIA_SAMPLE = `Dysphagia: subjective difficulty swallowing
Odynophagia: painful swallowing`;

const HTN_SAMPLE = `Hypertension: high blood pressure`;

const ASCITES_SAMPLE = `Causes of ascites:
Cirrhosis
Heart failure
Nephrotic syndrome
Tuberculous peritonitis
Malignancy`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, rule: string, label: string, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ [${rule}] ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ [${rule}] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n========== Examiner Box — Client Acceptance ==========\n');

// ---------------------------------------------------------------------------
// Rule 1 — Intent first (do NOT score non-answers)
// ---------------------------------------------------------------------------
console.log('1) Intent detection (non-answers must not be scored as wrong)');
const intentCases: Array<[string, ReturnType<typeof detectVivaStudentIntent>]> = [
  ['coach me', 'hint'],
  ['give me a hint', 'hint'],
  ['help', 'hint'],
  ['teach me', 'hint'],
  ['ساعدني', 'hint'],
  ['تلميح', 'hint'],
  ['repeat the question', 'repeat'],
  ['أعد السؤال', 'repeat'],
  ["I don't understand", 'clarify'],
  ['وضح السؤال', 'clarify'],
  ['hello', 'off_topic'],
  ['شكرا', 'off_topic'],
  ["I don't know", 'give_up'],
  ['معرفش', 'give_up'],
  ['odynophagia is painful swallowing', 'answer'],
  ['Dysphagia is difficulty swallowing', 'answer'],
];
for (const [text, expected] of intentCases) {
  const got = detectVivaStudentIntent(text);
  assert(got === expected, 'R1 Intent', `${JSON.stringify(text)} → ${expected}`, `got ${got}`);
}

// ---------------------------------------------------------------------------
// Rule 2 — Meaning over keywords (wrong definition must FAIL)
// ---------------------------------------------------------------------------
console.log('\n2) Meaning over keywords');
{
  const wrong = debugScoreViva('odynophagia is a tenderness over tibia', DYSPHAGIA_SAMPLE);
  assert(wrong.matched.length === 0, 'R2 Meaning', 'wrong definition NOT credited', JSON.stringify(wrong.matched));

  const wrongFb = debugEvaluateHistoryVivaLocal(
    'odynophagia is a tenderness over tibia',
    DYSPHAGIA_SAMPLE,
    'Dysphagia is a subjective difficulty swallowing.\nodynophagia is a tenderness over tibia',
  );
  assert(wrongFb.advance === false, 'R2 Meaning', 'wrong definition does not advance');
  assert(
    /not quite|mixes up|not "/i.test(wrongFb.feedback),
    'R2 Meaning',
    'explains why definition is wrong',
    wrongFb.feedback,
  );

  const keywordOnlyTrap = debugScoreViva(
    'odynophagia is bone pain in the shin',
    DYSPHAGIA_SAMPLE,
  );
  assert(keywordOnlyTrap.coverage === 0, 'R2 Meaning', 'keyword alone with wrong meaning = 0');
}

// ---------------------------------------------------------------------------
// Rule 2b — Synonyms / plain English accepted
// ---------------------------------------------------------------------------
console.log('\n2b) Synonyms & plain English');
{
  const syn = debugScoreViva('painful swallowing', DYSPHAGIA_SAMPLE);
  assert(
    syn.matched.some((m) => /odynophagia/i.test(m)),
    'R2 Synonym',
    'painful swallowing ≈ Odynophagia',
    JSON.stringify(syn.matched),
  );

  const plain = debugScoreViva('high blood pressure', HTN_SAMPLE);
  assert(plain.coverage === 1, 'R2 Synonym', 'high blood pressure ≈ Hypertension', String(plain.coverage));

  const correctDef = debugScoreViva(
    'Dysphagia is a subjective difficulty swallowing',
    DYSPHAGIA_SAMPLE,
  );
  assert(
    correctDef.matched.some((m) => /dysphagia/i.test(m)),
    'R2 Synonym',
    'correct dysphagia definition accepted',
  );
}

// ---------------------------------------------------------------------------
// Rule 5 — Extra correct info never penalized
// ---------------------------------------------------------------------------
console.log('\n5) Extra correct information');
{
  const extra = debugScoreViva(
    'Dysphagia is subjective difficulty swallowing, often assessed carefully in peptic ulcer alarm features',
    DYSPHAGIA_SAMPLE,
  );
  assert(
    extra.matched.some((m) => /dysphagia/i.test(m)),
    'R5 Extra',
    'extra correct context still credits dysphagia',
  );
}

// ---------------------------------------------------------------------------
// Rule 6 — Order does not matter
// ---------------------------------------------------------------------------
console.log('\n6) Order independence');
{
  const a = debugScoreViva(
    'Odynophagia is painful swallowing. Dysphagia is subjective difficulty swallowing.',
    DYSPHAGIA_SAMPLE,
  );
  const b = debugScoreViva(
    'Dysphagia is subjective difficulty swallowing. Odynophagia is painful swallowing.',
    DYSPHAGIA_SAMPLE,
  );
  assert(a.coverage === 1 && b.coverage === 1, 'R6 Order', 'both orders get full coverage');
}

// ---------------------------------------------------------------------------
// Rule 8 — Partial answers
// ---------------------------------------------------------------------------
console.log('\n8) Partial credit');
{
  const partial = debugEvaluateHistoryVivaLocal(
    'Dysphagia is a subjective difficulty swallowing',
    DYSPHAGIA_SAMPLE,
  );
  assert(partial.advance === false, 'R8 Partial', 'one of two points → do not advance');
  assert(
    /good|mentioned|important|correct/i.test(partial.feedback),
    'R8 Partial',
    'acknowledges the correct point',
    partial.feedback,
  );
  assert(
    !/odynophagia is painful/i.test(partial.feedback),
    'R8 Partial',
    'does NOT dump the missing model definition',
    partial.feedback,
  );
}

// ---------------------------------------------------------------------------
// Rule 7 — Full correct answers advance
// ---------------------------------------------------------------------------
console.log('\n7) Full correct answers');
{
  const full = debugEvaluateHistoryVivaLocal(
    'Dysphagia is subjective difficulty swallowing. Odynophagia is painful swallowing.',
    DYSPHAGIA_SAMPLE,
  );
  assert(full.advance === true, 'R7 Full', 'both definitions → advance');
  assert(/excellent|correct|great job|covered/i.test(full.feedback), 'R7 Full', 'congratulates', full.feedback);
}

// ---------------------------------------------------------------------------
// Rule 9 — Incorrect answers explain the misconception
// ---------------------------------------------------------------------------
console.log('\n9) Incorrect answers explain the error');
{
  const bad = debugEvaluateHistoryVivaLocal(
    'odynophagia is a tenderness over tibia',
    DYSPHAGIA_SAMPLE,
  );
  assert(bad.advance === false, 'R9 Incorrect', 'does not advance');
  assert(
    /not quite|mixes up|clinical meaning/i.test(bad.feedback) && !/^wrong\.?$/i.test(bad.feedback.trim()),
    'R9 Incorrect',
    'explains misconception (not just "Wrong")',
    bad.feedback,
  );
}

// ---------------------------------------------------------------------------
// Rule 12 — Do not guess missing information
// ---------------------------------------------------------------------------
console.log('\n12) Do not guess missing info');
{
  const calcium = debugScoreViva('Calcium', 'Hypercalcemia: high calcium level in the blood');
  // Naming a related word without the concept should not auto-complete hypercalcemia.
  assert(
    calcium.coverage < 1,
    'R12 No guess',
    '"Calcium" alone is not full Hypercalcemia credit',
    String(calcium.coverage),
  );
}

// ---------------------------------------------------------------------------
// Progressive multi-turn (client video style + meaning)
// ---------------------------------------------------------------------------
console.log('\nProgressive multi-turn (meaning preserved)');
{
  const turn1 = debugEvaluateHistoryVivaLocal(
    'Dysphagia is subjective difficulty swallowing',
    DYSPHAGIA_SAMPLE,
  );
  assert(turn1.advance === false, 'Progress', 'turn1 partial');

  const turn2Wrong = debugEvaluateHistoryVivaLocal(
    'odynophagia is tenderness over tibia',
    DYSPHAGIA_SAMPLE,
    'Dysphagia is subjective difficulty swallowing\nodynophagia is tenderness over tibia',
  );
  assert(turn2Wrong.advance === false, 'Progress', 'turn2 wrong def stays incomplete');
  assert(
    /not quite|mixes up/i.test(turn2Wrong.feedback),
    'Progress',
    'turn2 explains wrong odynophagia',
    turn2Wrong.feedback,
  );

  const turn2Ok = debugEvaluateHistoryVivaLocal(
    'odynophagia means painful swallowing',
    DYSPHAGIA_SAMPLE,
    'Dysphagia is subjective difficulty swallowing\nodynophagia means painful swallowing',
  );
  assert(turn2Ok.advance === true, 'Progress', 'turn2 correct meaning completes');
}

// ---------------------------------------------------------------------------
// Ascites list — multiple correct causes (Rule 4 / 11)
// ---------------------------------------------------------------------------
console.log('\n4/11) Multiple acceptable points / open lists');
{
  const causes = debugScoreViva('cirrhosis and heart failure and nephrotic syndrome', ASCITES_SAMPLE);
  assert(causes.matched.length >= 3, 'R4/R11 Lists', 'credits multiple correct causes', String(causes.matched.length));
  assert(causes.coverage < 1, 'R4/R11 Lists', 'still partial if not all listed', String(causes.coverage));
}

// ---------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`Result: ${passed} passed, ${failed} failed`);
console.log('======================================================\n');

if (failed > 0) process.exit(1);
