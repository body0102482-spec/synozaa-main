/**
 * Examiner history viva — evaluate answers before advancing.
 * Run: npx tsx scripts/test-examiner-viva.ts
 */
import type { Case } from '@prisma/client';
import {
  buildExaminerVivaOpening,
  getCurrentVivaQuestionNumber,
  pickVivaQuestionsForSession,
  respondToHistoryVivaAnswer,
  studentGaveUp,
  VIVA_QUESTIONS_PER_SESSION,
} from '../src/services/examinerVivaService.js';

const tarekCase = {
  id: 'case-tarek',
  titleEn: 'Rheumatic Valvular Heart Disease',
  finalDiagnosis: 'severe aortic stenosis',
} as Case;

const samiraCase = {
  id: 'case-samira',
  titleEn: 'Acute Heart Failure — Dilated Cardiomyopathy',
  finalDiagnosis: 'Acute decompensated heart failure',
} as Case;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n=== Examiner viva service ===\n');

const sessionA = 'session-aaa-111';
const sessionB = 'session-bbb-222';

const qA = pickVivaQuestionsForSession(sessionA, tarekCase);
const qB = pickVivaQuestionsForSession(sessionB, tarekCase);
const qA2 = pickVivaQuestionsForSession(sessionA, tarekCase);

assert(qA.length === VIVA_QUESTIONS_PER_SESSION, 'picks 5 questions', String(qA.length));
assert(JSON.stringify(qA) === JSON.stringify(qA2), 'same session gets same questions');
assert(JSON.stringify(qA) !== JSON.stringify(qB), 'different sessions get different questions');

const opening = buildExaminerVivaOpening(sessionA, tarekCase);
assert(!/Question\s+1\s+of\s+5/i.test(opening), 'opening has no question numbering', opening);
assert(opening.includes(qA[0].question), 'opening uses first picked question');

const stage = 'history:examiner';
const baseMessages = [
  { role: 'EXAMINER', stage, content: opening },
];

assert(getCurrentVivaQuestionNumber(baseMessages, stage, qA) === 1, 'tracks question 1 after opening');

assert(studentGaveUp("I don't know doctor"), 'detects English give-up');
assert(studentGaveUp("don't know"), 'detects bare "don\'t know"');
assert(studentGaveUp('مش عارف يا دكتور'), 'detects Arabic give-up');

const penicillinQ =
  qA.find((q) => q.question.toLowerCase().includes('penicillin'))?.question ??
  'What is the purpose of penicillin prophylaxis after rheumatic fever?';

const wrongReply = await respondToHistoryVivaAnswer(
  sessionA,
  tarekCase,
  baseMessages,
  stage,
  'i think with CBC',
);
assert(!wrongReply.includes(qA[1].question), 'wrong answer does not advance', wrongReply);
assert(wrongReply.trim().length > 20, 'wrong answer gives feedback', wrongReply);

const giveUpReply = await respondToHistoryVivaAnswer(
  sessionA,
  tarekCase,
  baseMessages,
  stage,
  "don't know",
);
assert(giveUpReply.includes(qA[1].question), 'bare give-up advances to Q2', giveUpReply);

const giveUpReply2 = await respondToHistoryVivaAnswer(
  sessionA,
  tarekCase,
  baseMessages,
  stage,
  "I don't know",
);
assert(giveUpReply2.includes(qA[1].question), 'give-up advances to Q2', giveUpReply2);

let messages = [...baseMessages];
for (let i = 0; i < VIVA_QUESTIONS_PER_SESSION - 1; i += 1) {
  const reply = await respondToHistoryVivaAnswer(
    sessionA,
    tarekCase,
    messages,
    stage,
    "I don't know",
  );
  messages = [
    ...messages,
    { role: 'STUDENT', stage, content: 'student answer' },
    { role: 'EXAMINER', stage, content: reply },
  ];
}

const closingReply = await respondToHistoryVivaAnswer(
  sessionA,
  tarekCase,
  messages,
  stage,
  "I don't know",
);
assert(/completes the examiner viva/i.test(closingReply), 'closes after Q5', closingReply);

const closingAr = await respondToHistoryVivaAnswer(
  `${sessionA}-ar`,
  tarekCase,
  [
    ...messages,
    { role: 'STUDENT', stage, content: "I don't know" },
    { role: 'EXAMINER', stage, content: closingReply },
  ],
  stage,
  "مش عارف",
  'AR',
);
assert(/بالتوفيق/.test(closingAr) || /خلصنا أسئلة/.test(closingAr), 'Arabic closing uses بالتوفيق', closingAr);

const samiraQ = pickVivaQuestionsForSession(sessionA, samiraCase);
assert(samiraQ[0].question !== qA[0].question || samiraQ[1].question !== qA[1].question, 'different case pool changes questions');

const shuntSampleAnswer = `Causes of a left-to-right shunt include:
- Ventricular septal defect (VSD).
- Atrial septal defect (ASD).
- Patent ductus arteriosus (PDA).`;

const vsdCase = {
  id: 'case-vsd',
  titleEn: 'VSD (Ventricular Septal Defect)',
  finalDiagnosis: 'Ventricular septal defect',
  examinerQuestions: JSON.stringify(
    Array.from({ length: 5 }, (_, index) => ({
      id: `q${index + 1}`,
      question: 'What are the causes of a left-to-right shunt?',
      sampleAnswer: shuntSampleAnswer,
    })),
  ),
} as Case;

const vsdSession = 'session-vsd-shunt';
const vsdOpening = buildExaminerVivaOpening(vsdSession, vsdCase);
const vsdMessages = [{ role: 'EXAMINER', stage, content: vsdOpening }];

const asdReply = await respondToHistoryVivaAnswer(
  vsdSession,
  vsdCase,
  vsdMessages,
  stage,
  'Atrial septal defect (ASD)',
);
const vsdQuestions = pickVivaQuestionsForSession(vsdSession, vsdCase);
assert(!/covered all/i.test(asdReply), 'first partial point stays on Q1', asdReply);
assert(/good|correct/i.test(asdReply), 'partial point gets encouragement', asdReply);
assert(!/VSD|PDA|ventricular|patent/i.test(asdReply), 'partial point does not leak remaining causes', asdReply);

const vsdMessages2 = [
  ...vsdMessages,
  { role: 'STUDENT', stage, content: 'Atrial septal defect (ASD)' },
  { role: 'EXAMINER', stage, content: asdReply },
];
const vsdReply = await respondToHistoryVivaAnswer(
  vsdSession,
  vsdCase,
  vsdMessages2,
  stage,
  'Ventricular septal defect (VSD)',
);
assert(!/covered all/i.test(vsdReply), 'second partial point stays on Q1', vsdReply);
assert(/good|correct|partial|nice point/i.test(vsdReply), 'second partial point gets encouragement', vsdReply);

const vsdMessages3 = [
  ...vsdMessages2,
  { role: 'STUDENT', stage, content: 'Ventricular septal defect (VSD)' },
  { role: 'EXAMINER', stage, content: vsdReply },
];
const pdaReply = await respondToHistoryVivaAnswer(
  vsdSession,
  vsdCase,
  vsdMessages3,
  stage,
  'Patent ductus arteriosus (PDA)',
);
assert(
  /covered all|correct|complete/i.test(pdaReply.toLowerCase()) && pdaReply.includes(vsdQuestions[1].question),
  'all points advance to next question',
  pdaReply,
);
assert(/correct|covered/i.test(pdaReply.toLowerCase()), 'full answer acknowledged', pdaReply);

// Prose sample (comma list) — one cause must get partial credit, not a hard reject
const pruritusCase = {
  id: 'case-pruritus',
  titleEn: 'Medical causes of pruritus',
  finalDiagnosis: 'Obstructive jaundice',
  examinerQuestions: JSON.stringify(
    Array.from({ length: 5 }, (_, index) => ({
      id: `pq${index + 1}`,
      question: "Medical causes of 'pruritus'?",
      sampleAnswer:
        'Medical causes of pruritus include obstructive jaundice, bilharziasis and diabetes mellitus.',
    })),
  ),
} as Case;
const pruritusSession = 'session-pruritus-1';
const pruritusOpening = buildExaminerVivaOpening(pruritusSession, pruritusCase);
const pruritusMessages = [{ role: 'EXAMINER', stage, content: pruritusOpening }];
const oneCauseReply = await respondToHistoryVivaAnswer(
  pruritusSession,
  pruritusCase,
  pruritusMessages,
  stage,
  'obstructive jaundice',
);
assert(/correct|incomplete|still|hint|more/i.test(oneCauseReply.toLowerCase()), 'one cause gets partial credit', oneCauseReply);
assert(!/not quite|does not address/i.test(oneCauseReply.toLowerCase()), 'one cause is not hard-rejected', oneCauseReply);

const idkWithSample = await respondToHistoryVivaAnswer(
  pruritusSession,
  pruritusCase,
  pruritusMessages,
  stage,
  'مش عارف',
);
assert(/expected answer|obstructive jaundice/i.test(idkWithSample), 'give-up reveals sample answer', idkWithSample);

const thrillSampleAnswer = `Causes of a thrill include:
- **Apical systolic thrill:** Mitral regurgitation.
- **Apical diastolic thrill:** Mitral stenosis.
- **Left parasternal thrill:** Ventricular septal defect.
- **Basal thrill:** Aortic stenosis.`;

const thrillEval = await import('../src/services/aiService.js').then((m) =>
  m.evaluateHistoryVivaAnswer(
    vsdCase,
    'What are the causes of a thrill in a cardiac patient?',
    2,
    'Apical systolic thrill: Mitral regurgitation',
    thrillSampleAnswer,
    'Apical systolic thrill: Mitral regurgitation',
  ),
);
assert(!thrillEval.advance, 'single thrill point does not advance', thrillEval.feedback);
assert(/apical systolic|correct/i.test(thrillEval.feedback), 'credits MR thrill point', thrillEval.feedback);
assert(
  /correct|incomplete|still|hint|more/i.test(thrillEval.feedback),
  'partial thrill answer encourages completion',
  thrillEval.feedback,
);
assert(
  !/mitral stenosis/i.test(thrillEval.feedback),
  'does not reveal the MS model answer verbatim',
  thrillEval.feedback,
);

const ascitesSample = `- **Minimal / Earliest Ascites (< 500 mL):** Detected via Abdominal Ultrasound or by auscultating the Puddle sign.
- **Mild Ascites (500 - 1500 mL):** Detected via the Knee-Elbow percussory test.
- **Moderate Ascites (1500 - 3000 mL):** Detected via Shifting Dullness using light percussion.
- **Tense Ascites (> 3000 mL):** Easily inspected as generalized distension with full flanks and an everted umbilicus.`;

const ascitesEval = await import('../src/services/aiService.js').then((m) =>
  m.evaluateHistoryVivaAnswer(
    vsdCase,
    'How to detect ascites clinically based on fluid volume?',
    1,
    'Minimal / Earliest Ascites (< 500 mL): Detected via Abdominal Ultrasound or by auscultating the Puddle sign.',
    ascitesSample,
    'Minimal / Earliest Ascites (< 500 mL): Detected via Abdominal Ultrasound or by auscultating the Puddle sign.',
  ),
);
assert(!ascitesEval.advance, 'ascites partial does not advance', ascitesEval.feedback);
assert(/good|correct|well spotted|nice point/i.test(ascitesEval.feedback), 'ascites partial gets praise', ascitesEval.feedback);
assert(
  !/knee-elbow|shifting dullness|everted umbilicus/i.test(ascitesEval.feedback),
  'ascites feedback does not reveal full remaining answers',
  ascitesEval.feedback,
);
assert(!/mild|moderate|tense/i.test(ascitesEval.feedback), 'ascites does not leak remaining categories', ascitesEval.feedback);

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('\nAll examiner viva tests passed.\n');
