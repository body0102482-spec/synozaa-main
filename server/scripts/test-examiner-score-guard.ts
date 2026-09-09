process.env.AI_PROVIDER = 'mock';

const { guardExaminerEvaluationScores } = await import('../src/services/aiService.js');

const base = {
  totalScore: 50,
  communicationScore: 50,
  historyTakingScore: 50,
  clinicalReasonScore: 50,
  organizationScore: 50,
  closingScore: 50,
  strengths: 'base',
  weaknesses: 'base',
  missedQuestions: 'base',
  clinicalErrors: 'base',
  recommendations: 'base',
  idealApproach: 'base',
  fullReport: 'base',
};

const ai = {
  ...base,
  totalScore: 99,
  communicationScore: 90,
  historyTakingScore: 80,
  clinicalReasonScore: 20,
  organizationScore: 55,
  closingScore: 100,
  strengths: 'case-aware strengths',
};

const result = guardExaminerEvaluationScores(ai, base);

console.log(result);

const checks: Array<[string, boolean]> = [
  ['AI score influences communication', result.communicationScore > base.communicationScore],
  ['AI score influences history', result.historyTakingScore > base.historyTakingScore],
  ['Safety rail limits extreme clinical drop', result.clinicalReasonScore >= 26],
  ['Safety rail limits extreme closing rise', result.closingScore <= 74],
  ['Narrative fields remain AI-generated', result.strengths === 'case-aware strengths'],
  ['Total is recomputed from guarded dimensions', result.totalScore >= 0 && result.totalScore <= 100],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(ok ? 'OK' : 'FAIL', name);
  if (!ok) failed++;
}

if (failed) {
  console.error(`FAILED: ${failed} check(s)`);
  process.exit(1);
}

console.log('ALL EXAMINER SCORE GUARD TESTS PASSED');