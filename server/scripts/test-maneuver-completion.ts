process.env.AI_PROVIDER = 'mock';

const { getManeuverCompletionState, getManeuverExaminerResponse } = await import('../src/services/aiService.js');

const scarCase = {
  physicalExam: JSON.stringify({ inspection: 'Mildly tachypneic cooperative adolescent sitting upright. Evident linear hyperpigmented scar from previous chest tube insertion (past pleural effusion) in left mid-axillary line. No precordial bulge, no dilated superficial veins, no chest skin lesions.' }),
} as any;
const murmurCase = {
  physicalExam: JSON.stringify({ auscultation: 'Pansystolic murmur; soft S1; radiation to the axilla.' }),
} as any;

let failed = 0;
function check(value: boolean, label: string) {
  console.log(`${value ? '✓' : '✗'} ${label}`);
  if (!value) failed++;
}

const scarPartial = getManeuverCompletionState(scarCase, 'inspection', ["there's a scar"]);
check(scarPartial.demonstrated.length === 1 && !scarPartial.complete, `partial scar is credited but not solved (${JSON.stringify(scarPartial)})`);
check(scarPartial.missing.length > 0 && scarPartial.modelAnswer === '', 'partial state retains missing component without model-answer reveal');
const scarReply = await getManeuverExaminerResponse(
  scarCase,
  'inspection',
  "there's a scar",
  [],
  'EN',
  undefined,
  true,
);
check(/correct/i.test(scarReply) && /scar/i.test(scarReply) && /where.*scar.*located/i.test(scarReply), 'partial scar reply credits presence and probes location');
check(!/left lateral|thoracotomy/i.test(scarReply), 'scar location probe does not reveal the model answer');
const scarDone = getManeuverCompletionState(scarCase, 'inspection', ["there's a scar", 'left mid-axillary line chest tube scar']);
check(!scarDone.complete && scarDone.missing.some((point) => /precordial bulge/i.test(point)), 'real seeded inspection retains independent negative findings after scar completion');
const afterScarReply = await getManeuverExaminerResponse(
  scarCase, 'inspection', 'linear hyperpigmented scar from previous chest tube insertion',
  [{ role: 'STUDENT', content: "there's a scar" }, { role: 'STUDENT', content: 'left mid-axillary line' }],
  'EN', undefined, true,
);
check(/precordial bulge/i.test(afterScarReply), 'real seeded inspection targets the next missing domain after scar completion');
check(!/what is one further relevant finding|more findings are expected/i.test(afterScarReply), 'real seeded inspection avoids generic-only follow-up');

const murmurOne = getManeuverCompletionState(murmurCase, 'auscultation', ['pansystolic murmur']);
check(!murmurOne.complete && murmurOne.demonstrated.length === 1, 'murmur partial remains incomplete');
const murmurTwo = getManeuverCompletionState(murmurCase, 'auscultation', ['pansystolic murmur', 'soft S1']);
check(!murmurTwo.complete && murmurTwo.demonstrated.length === 2, 'prior murmur credit persists without completion');
const murmurDone = getManeuverCompletionState(murmurCase, 'auscultation', ['pansystolic murmur', 'soft S1', 'radiates to the axilla']);
check(murmurDone.complete && murmurDone.demonstrated.length === 3, 'murmur solves only after radiation');
const repeat = getManeuverCompletionState(murmurCase, 'auscultation', ['pansystolic murmur', 'pansystolic murmur']);
check(repeat.demonstrated.length === 1 && !repeat.complete, 'repeat earns no duplicate completion credit');
const isolated = getManeuverCompletionState(murmurCase, 'auscultation', ['soft S1']);
check(isolated.demonstrated.length === 1 && !isolated.complete, 'state is isolated to supplied session/student turns');

// Unsure / give up on sub-question with examiner follow-up question:
const unsureFollowUp = getManeuverCompletionState(
  scarCase,
  'inspection',
  ["there's a scar", "انا مش متاكد بصراحة"],
  "مفيش مشكلة خالص. الندبة دي موجودة في الـ left mid-axillary line. طيب، إيه تاني ممكن تلاحظه في صدر المريض أثناء الـ inspection؟",
);
check(!unsureFollowUp.complete, 'unsure sub-question with active examiner follow-up question does NOT complete maneuver');

const concluded = getManeuverCompletionState(
  scarCase,
  'inspection',
  ["there's a scar", "left mid-axillary line"],
  "أحسنت، كده تم استعراض كل علامات فحص inspection. يمكنك الانتقال للخطوة التالية.",
);
check(concluded.complete, 'explicitly concluded maneuver by examiner marks completion');

if (failed) process.exit(1);
console.log('All maneuver completion regressions passed.');
