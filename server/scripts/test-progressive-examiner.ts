/**
 * Regression coverage for written examination-viva partial credit and probing.
 * Run: npx tsx scripts/test-progressive-examiner.ts
 */
process.env.AI_PROVIDER = 'mock';

const { getManeuverExaminerResponse, getExaminerEvaluation, debugScoreManeuver } = await import('../src/services/aiService.js');

const caseData = {
  id: 'progressive-murmur', titleEn: 'Mitral regurgitation', titleAr: 'Mitral regurgitation',
  finalDiagnosis: 'Mitral regurgitation', categoryId: null,
  patientName: 'Test patient', patientAge: 50, patientGender: 'Female', patientNationality: 'Egyptian',
  chiefComplaint: 'Breathlessness.', medicalHistory: '', medicationHistory: '', surgicalHistory: '',
  familyHistory: '', socialHistory: '', teachingPoints: '', evaluationRubric: '', examinerQuestions: '[]',
  stationConfig: null,
  physicalExam: JSON.stringify({
    inspection: '', palpation: '', percussion: '',
    // Real seeded auscultation shape: deliberately dense prose containing
    // other aortic, mitral, and lung findings that the student did not state.
    auscultation: 'Aortic area: muffled/soft S2; loud ejection systolic murmur at 1st aortic area radiating to carotids and apex. Mitral area: soft muffled S1; loud blowing pansystolic murmur at apex radiating to left axilla. Mild expiratory wheeze bilaterally (asthma).',
  }),
} as any;

const progressiveCase = {
  ...caseData,
  id: 'progressive-murmur-components',
  physicalExam: JSON.stringify({
    inspection: '', palpation: '', percussion: '',
    auscultation: 'Pansystolic murmur; soft S1; radiation to the axilla.',
  }),
};

let failed = 0;
function assert(condition: boolean, label: string, detail: string) {
  console.log(`${condition ? '✓' : '✗'} ${label}: ${detail}`);
  if (!condition) failed++;
}

const first = await getManeuverExaminerResponse(
  caseData, 'auscultation', 'pansystolic murmur', [], 'EN', undefined, true,
);
const exactCoverage = debugScoreManeuver(
  'pansystolic murmur',
  JSON.parse(caseData.physicalExam).auscultation,
);
assert(/correct/i.test(first) && /pansystolic/i.test(first), 'partial correct is credited', first);
assert(/heart sounds|radiat/i.test(first), 'partial correct gets targeted missing-component probe', first);
assert(!/axilla/i.test(first), 'probe does not leak the expected radiation', first);
assert(
  !/soft s1|soft s2|loud s2|ejection systolic|mitral area|lung|wheeze|muffled/i.test(first),
  'exact "pansystolic murmur" credits no unstated expected finding',
  first,
);
assert(exactCoverage.matched.length === 1 && /pansystolic murmur/i.test(exactCoverage.matched[0]), 'demonstrated component set contains only pansystolic murmur', JSON.stringify(exactCoverage.matched));
assert(
  !/soft\s+s1|soft\s+s2|loud\s+s2|ejection\s+systolic|mitral\s+area|axilla|wheeze|lung/i.test(exactCoverage.matched.join(' ')),
  'demonstrated component set excludes every unstated expected finding',
  JSON.stringify(exactCoverage.matched),
);

const secondHistory = [
  { role: 'STUDENT', content: 'pansystolic murmur' },
  { role: 'EXAMINER', content: first },
];
const second = await getManeuverExaminerResponse(
  progressiveCase, 'auscultation', 'soft S1', secondHistory, 'EN', undefined, true,
);
assert(/correct/i.test(second) && /soft s1/i.test(second), 'later correct component retains earlier credit', second);
assert(/radiat/i.test(second), 'only remaining radiation domain is probed', second);
assert(!/heart sounds/i.test(second), 'already credited heart sound is not re-probed', second);
assert(!/axilla/i.test(second), 'second probe does not leak the answer', second);

const repeatedHistory = [...secondHistory, { role: 'STUDENT', content: 'soft S1' }, { role: 'EXAMINER', content: second }];
const repeated = await getManeuverExaminerResponse(
  progressiveCase, 'auscultation', 'soft S1', repeatedHistory, 'EN', undefined, true,
);
assert(/already credited/i.test(repeated), 'repeated component receives no duplicate credit', repeated);
assert(/radiat/i.test(repeated) && !/heart sounds/i.test(repeated), 'repeat moves to the still-missing domain only', repeated);

const mixed = await getManeuverExaminerResponse(
  progressiveCase, 'auscultation', 'pansystolic murmur radiating to the carotids', [], 'EN', undefined, true,
);
assert(/correct/i.test(mixed) && /pansystolic/i.test(mixed), 'mixed answer preserves correct component credit', mixed);
assert(/recheck/i.test(mixed), 'mixed answer flags the uncredited component without rejecting the whole answer', mixed);
assert(/radiat/i.test(mixed) && !/axilla/i.test(mixed), 'mixed answer remains partial without answer leakage', mixed);

const completeHistory = [...repeatedHistory, { role: 'STUDENT', content: 'radiation to the axilla' }];
const complete = await getManeuverExaminerResponse(
  progressiveCase, 'auscultation', 'radiation to the axilla', completeHistory, 'EN', undefined, true,
);
assert(/move on|complete|covered all/i.test(complete), 'progressive components complete the maneuver', complete);

const partialMessages = [{ role: 'STUDENT', stage: 'examination:auscultation', content: 'pansystolic murmur' }];
const repeatedMessages = [
  ...partialMessages,
  { role: 'EXAMINER', stage: 'examination:auscultation', content: first },
  { role: 'STUDENT', stage: 'examination:auscultation', content: 'pansystolic murmur' },
];
const partialScore = await getExaminerEvaluation(progressiveCase, partialMessages, 'EN');
const repeatedScore = await getExaminerEvaluation(progressiveCase, repeatedMessages, 'EN');
assert(
  partialScore.clinicalReasonScore === repeatedScore.clinicalReasonScore,
  'examiner follow-up and repetition do not inflate clinical-reason score',
  `${partialScore.clinicalReasonScore} vs ${repeatedScore.clinicalReasonScore}`,
);
assert(partialScore.clinicalReasonScore > 0, 'demonstrated partial component retains final-score credit', String(partialScore.clinicalReasonScore));

if (failed) {
  console.error(`\n${failed} progressive examiner regression(s) failed.`);
  process.exit(1);
}
console.log('\nAll progressive examiner regressions passed.');
