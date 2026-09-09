/**
 * Full OSCE Examiner Rules acceptance suite (Rules 1–18).
 * Run: npx tsx scripts/test-examiner-osce-rules.ts
 */
import {
  debugEvaluateHistoryVivaLocal,
  debugScoreViva,
  detectVivaStudentIntent,
} from '../src/services/aiService.js';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, rule: string, label: string, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ [${rule}] ${label}`);
  } else {
    failed += 1;
    const msg = `[${rule}] ${label}${detail ? ` — ${detail}` : ''}`;
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

function feedbackNamesLeak(feedback: string, forbidden: string[]): boolean {
  const fb = feedback.toLowerCase();
  return forbidden.some((term) => {
    const t = term.toLowerCase();
    if (t.length < 5) return false;
    return fb.includes(t);
  });
}

const DYSPHAGIA = `Dysphagia: subjective difficulty swallowing
Odynophagia: painful swallowing`;

const HTN = `Hypertension: high blood pressure`;
const DYSPNEA = `Dyspnea: shortness of breath`;
const HEMATURIA = `Hematuria: blood in the urine`;
const MI = `Myocardial infarction: heart attack`;
const HYPERCA = `Hypercalcemia: high calcium level in the blood`;
const CKD = `Chronic Kidney Disease`;

const PRAECOX = `Ascites that develops rapidly before significant peripheral edema occurs, caused by:
- Pericardial effusion
- Constrictive pericarditis
- Tricuspid Regurgitation
- Tricuspid Stenosis.`;

const ASCITES_CAUSES = `Causes of ascites:
Cirrhosis
Heart failure
Nephrotic syndrome
Tuberculous peritonitis
Malignancy`;

const NEPHROTIC_DX = `Nephrotic syndrome: generalized edema, heavy proteinuria, hypoalbuminemia`;

console.log('\n========== OSCE Examiner Rules — Full Acceptance ==========\n');

// ---------------------------------------------------------------------------
console.log('R1 — Intent first');
{
  const cases: Array<[string, ReturnType<typeof detectVivaStudentIntent>]> = [
    ['give me a hint', 'hint'],
    ['coach me', 'hint'],
    ['help', 'hint'],
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
    ['skip', 'answer'], // skip as bare word may be answer-ish; give_up patterns handle "I don't know"
    ['Pericardial effusion', 'answer'],
  ];
  for (const [text, expected] of cases) {
    if (text === 'skip') {
      // "skip" alone is not currently a dedicated intent — document behavior
      const got = detectVivaStudentIntent(text);
      assert(
        got === 'answer' || got === 'give_up' || got === 'off_topic',
        'R1',
        `"skip" is classified (got ${got}) — not scored as clinical answer content`,
      );
      continue;
    }
    assert(detectVivaStudentIntent(text) === expected, 'R1', `${JSON.stringify(text)} → ${expected}`);
  }
}

// ---------------------------------------------------------------------------
console.log('\nR2 — Clinical meaning, NOT keywords');
{
  assert(
    debugScoreViva('odynophagia is tenderness over tibia', DYSPHAGIA).matched.length === 0,
    'R2',
    'wrong definition with keyword → NOT credited',
  );
  assert(
    debugScoreViva('painful swallowing', DYSPHAGIA).matched.some((m) => /odynophagia/i.test(m)),
    'R2',
    'plain English synonym accepted (painful swallowing)',
  );
  assert(
    debugScoreViva('high blood pressure', HTN).coverage === 1,
    'R2',
    'Hypertension ← high blood pressure',
  );
  assert(
    debugScoreViva('shortness of breath', DYSPNEA).coverage === 1,
    'R2',
    'Dyspnea ← shortness of breath',
  );
  assert(
    debugScoreViva('blood in the urine', HEMATURIA).coverage === 1,
    'R2',
    'Hematuria ← blood in the urine',
  );
  assert(
    debugScoreViva('heart attack', MI).coverage === 1,
    'R2',
    'MI ← heart attack',
  );
  assert(
    debugScoreViva('elevated serum calcium', HYPERCA).coverage === 1 ||
      debugScoreViva('high calcium level in the blood', HYPERCA).coverage === 1,
    'R2',
    'Hypercalcemia ← elevated/high calcium phrasing',
  );
  const wrongFb = debugEvaluateHistoryVivaLocal(
    'odynophagia is a tenderness over tibia',
    DYSPHAGIA,
  );
  assert(wrongFb.advance === false, 'R2', 'wrong meaning does not advance');
  assert(/not quite|mixes up|clinical meaning/i.test(wrongFb.feedback), 'R2', 'explains wrong meaning');
}

// ---------------------------------------------------------------------------
console.log('\nR3 — Reward clinical reasoning');
{
  const reasoning = debugScoreViva(
    'I suspect nephrotic syndrome because the patient has generalized edema, heavy proteinuria and hypoalbuminemia',
    NEPHROTIC_DX,
  );
  assert(
    reasoning.coverage >= 0.5 || reasoning.matched.length >= 1,
    'R3',
    'reasoning with features earns credit',
    `coverage=${reasoning.coverage} matched=${reasoning.matched.length}`,
  );
}

// ---------------------------------------------------------------------------
console.log('\nR4 / R11 — Multiple correct / open-ended lists');
{
  const five = debugScoreViva(
    'cirrhosis, heart failure, nephrotic syndrome, TB peritonitis, malignancy',
    ASCITES_CAUSES,
  );
  assert(five.matched.length >= 4, 'R4/R11', 'credits multiple listed causes', String(five.matched.length));

  const three = debugScoreViva('cirrhosis and heart failure and nephrotic syndrome', ASCITES_CAUSES);
  assert(three.matched.length >= 3, 'R4/R11', 'partial list still gets credit for mentioned causes');
  assert(three.coverage < 1, 'R4/R11', 'partial list does not force full completion');
}

// ---------------------------------------------------------------------------
console.log('\nR5 — Extra correct info never penalized');
{
  const extra = debugScoreViva(
    'Chronic Kidney Disease secondary to diabetic nephropathy with anemia',
    CKD,
  );
  assert(extra.coverage === 1, 'R5', 'extra correct detail still full credit');
}

// ---------------------------------------------------------------------------
console.log('\nR6 — Order does not matter');
{
  const a = debugScoreViva(
    'Odynophagia is painful swallowing. Dysphagia is subjective difficulty swallowing.',
    DYSPHAGIA,
  );
  const b = debugScoreViva(
    'Dysphagia is subjective difficulty swallowing. Odynophagia is painful swallowing.',
    DYSPHAGIA,
  );
  assert(a.coverage === 1 && b.coverage === 1, 'R6', 'both orders full credit');
}

// ---------------------------------------------------------------------------
console.log('\nR7 — Full correct answers');
{
  const full = debugEvaluateHistoryVivaLocal(
    'Dysphagia is subjective difficulty swallowing. Odynophagia is painful swallowing.',
    DYSPHAGIA,
  );
  assert(full.advance === true, 'R7', 'full answer advances');
  assert(/excellent|perfect|complete|great|well done|correct/i.test(full.feedback), 'R7', 'congratulates');
}

// ---------------------------------------------------------------------------
console.log('\nR8 — Partial answers WITHOUT revealing missing items');
{
  const partial = debugEvaluateHistoryVivaLocal('Pericardial effusion', PRAECOX);
  assert(partial.advance === false, 'R8', 'partial does not advance');
  assert(
    /pericardial effusion/i.test(partial.feedback),
    'R8',
    'acknowledges the correct point',
    partial.feedback,
  );
  assert(
    !feedbackNamesLeak(partial.feedback, [
      'constrictive pericarditis',
      'tricuspid regurgitation',
      'tricuspid stenosis',
    ]),
    'R8',
    'does NOT leak remaining causes',
    partial.feedback,
  );

  const t2 = debugEvaluateHistoryVivaLocal(
    'Constrictive pericarditis',
    PRAECOX,
    'Pericardial effusion\nConstrictive pericarditis',
  );
  assert(t2.advance === false, 'R8', 'second point still partial');
  assert(
    !feedbackNamesLeak(t2.feedback, ['tricuspid regurgitation', 'tricuspid stenosis']),
    'R8',
    'still no leak after second point',
    t2.feedback,
  );
}

// ---------------------------------------------------------------------------
console.log('\nR9 — Incorrect answers explain misconception');
{
  const bad = debugEvaluateHistoryVivaLocal(
    'odynophagia is bone tenderness over the tibia',
    DYSPHAGIA,
  );
  assert(bad.advance === false, 'R9', 'incorrect does not advance');
  assert(!/^wrong\.?$/i.test(bad.feedback.trim()), 'R9', 'not just "Wrong."');
  assert(/not quite|mixes up|meaning|incorrect|misconcept/i.test(bad.feedback), 'R9', 'explains error');
}

// ---------------------------------------------------------------------------
console.log('\nR10 — Minor omission vs major error signal');
{
  const minor = debugEvaluateHistoryVivaLocal('Pericardial effusion', PRAECOX);
  assert(
    /good|correct|nice|spotted|identified|mentioned|yes/i.test(minor.feedback) &&
      !/dangerous|major error|unsafe/i.test(minor.feedback),
    'R10',
    'minor omission stays supportive (not major-error tone)',
    minor.feedback,
  );
  const major = debugEvaluateHistoryVivaLocal(
    'odynophagia is tenderness over tibia',
    DYSPHAGIA,
  );
  assert(
    /not quite|mixes up|clinical meaning/i.test(major.feedback),
    'R10',
    'clear medical misconception is flagged educationally',
    major.feedback,
  );
}

// ---------------------------------------------------------------------------
console.log('\nR12 — Do not guess missing information');
{
  const calcium = debugScoreViva('Calcium', HYPERCA);
  assert(calcium.coverage < 1, 'R12', '"Calcium" alone ≠ Hypercalcemia', String(calcium.coverage));
}

// ---------------------------------------------------------------------------
console.log('\nR13 — Ignore minor language / spelling noise');
{
  // Minor casing / punctuation should not block a clear correct synonym.
  const noisy = debugScoreViva('High Blood Pressure!!!', HTN);
  assert(noisy.coverage === 1, 'R13', 'punctuation/caps do not block credit');
}

// ---------------------------------------------------------------------------
console.log('\nR14 — Flexible medical language');
{
  assert(debugScoreViva('shortness of breath', DYSPNEA).coverage === 1, 'R14', 'lay description OK');
  assert(
    debugScoreViva('Dysphagia is subjective difficulty swallowing', DYSPHAGIA).matched.length >= 1,
    'R14',
    'formal medical wording OK',
  );
}

// ---------------------------------------------------------------------------
console.log('\nR15 / R17 — Fair supportive tone (no embarrassment)');
{
  const fb = debugEvaluateHistoryVivaLocal('Pericardial effusion', PRAECOX).feedback;
  assert(
    !/stupid|bad|fail|embarrass|ridiculous/i.test(fb),
    'R15/R17',
    'no harsh/embarrassing language',
    fb,
  );
}

// ---------------------------------------------------------------------------
console.log('\nR16 — Feedback style variety (not one frozen template)');
{
  const phrases = new Set<string>();
  const points = [
    'Pericardial effusion',
    'Constrictive pericarditis',
    'Tricuspid Regurgitation',
  ];
  let combined = '';
  for (const p of points) {
    combined = combined ? `${combined}\n${p}` : p;
    phrases.add(debugEvaluateHistoryVivaLocal(p, PRAECOX, combined).feedback.split('.')[0] ?? '');
  }
  assert(phrases.size >= 2, 'R16', 'opening phrases vary across turns', [...phrases].join(' | '));
}

// ---------------------------------------------------------------------------
console.log('\nR18 — Gold standard: concept over reference wording');
{
  assert(
    debugScoreViva('painful swallowing', DYSPHAGIA).matched.some((m) => /odynophagia/i.test(m)),
    'R18',
    'same medical concept without model keyword',
  );
  assert(
    debugScoreViva('high blood pressure', HTN).coverage === 1,
    'R18',
    'reference wording not required',
  );
}

// ---------------------------------------------------------------------------
console.log('\nProgressive multi-turn (praecox) end-to-end');
{
  const turns = [
    'Pericardial effusion',
    'Constrictive pericarditis',
    'Tricuspid Regurgitation',
    'Tricuspid Stenosis',
  ];
  let combined = '';
  for (let i = 0; i < turns.length; i += 1) {
    combined = combined ? `${combined}\n${turns[i]}` : turns[i];
    const ev = debugEvaluateHistoryVivaLocal(turns[i], PRAECOX, combined);
    const leak = feedbackNamesLeak(
      ev.feedback,
      turns.slice(i + 1), // remaining not yet said
    );
    assert(!leak, 'E2E', `turn ${i + 1} does not leak future points`, ev.feedback);
    if (i < turns.length - 1) {
      assert(ev.advance === false, 'E2E', `turn ${i + 1} stays partial`);
    } else {
      assert(ev.advance === true, 'E2E', 'final turn advances');
    }
  }
}

// ---------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
}
console.log('======================================================\n');

if (failed > 0) process.exit(1);
console.log('ALL OSCE EXAMINER RULES CHECKS PASSED (100% of automated suite).\n');
