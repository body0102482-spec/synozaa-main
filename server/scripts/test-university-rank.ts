import {
  calculateUniversityRank,
  normalizeUniversityName,
  selectUniversityCohort,
} from '../src/services/universityRankService.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sameUniversity = [
  { id: 'a', totalXp: 500 },
  { id: 'b', totalXp: 400 },
  { id: 'c', totalXp: 400 },
  { id: 'd', totalXp: 300 },
];

const b = calculateUniversityRank('b', sameUniversity);
assert(b?.rank === 2 && b.higherCount === 1 && b.cohortSize === 4, 'Expected B to rank #2 within its cohort.');
const c = calculateUniversityRank('c', sameUniversity);
assert(c?.rank === 2, 'Equal XP must use competition ranking.');
const d = calculateUniversityRank('d', sameUniversity);
assert(d?.rank === 4, 'Competition ranking must skip after a tie.');
const solo = calculateUniversityRank('solo', [{ id: 'solo', totalXp: 0 }]);
assert(solo?.rank === 1 && solo.cohortSize === 1, 'A one-student university must rank #1 even at zero XP.');
assert(calculateUniversityRank('missing', sameUniversity) === null, 'A student outside the cohort must not receive a rank.');

const candidates = [
  { id: 'self', role: 'STUDENT', universityId: 'uni-a', university: 'University A', totalXp: 400 },
  { id: 'same', role: 'STUDENT', universityId: 'uni-a', university: 'University A', totalXp: 500 },
  { id: 'other-university', role: 'STUDENT', universityId: 'uni-b', university: 'University B', totalXp: 9999 },
  { id: 'admin', role: 'ADMIN', universityId: 'uni-a', university: 'University A', totalXp: 9999 },
];
const structuredCohort = selectUniversityCohort(candidates[0], candidates);
assert(structuredCohort.length === 2, 'Structured university cohorts must exclude other universities and non-students.');
assert(calculateUniversityRank('self', structuredCohort)?.rank === 2, 'Structured university rank should use only same-university students.');

const customCandidates = [
  { id: 'custom-self', role: 'STUDENT', universityId: null, university: '  Custom   Medical University ', totalXp: 20 },
  { id: 'custom-peer', role: 'STUDENT', universityId: null, university: 'custom medical university', totalXp: 30 },
  { id: 'custom-near-match', role: 'STUDENT', universityId: null, university: 'Custom Medical University Hospital', totalXp: 100 },
  { id: 'structured-same-name', role: 'STUDENT', universityId: 'partner-id', university: 'Custom Medical University', totalXp: 100 },
];
const customCohort = selectUniversityCohort(customCandidates[0], customCandidates);
assert(customCohort.length === 2, 'Custom university matching must be normalized and exact, without mixing structured universities.');
assert(selectUniversityCohort({ role: 'STUDENT', universityId: null, university: null }, customCandidates).length === 0, 'Missing university must not receive a global rank.');

assert(
  normalizeUniversityName('  Other   University ') === normalizeUniversityName('other university'),
  'Custom universities should match only after safe whitespace/case normalization.',
);
assert(
  normalizeUniversityName('Other University') !== normalizeUniversityName('Other University Hospital'),
  'Custom universities must not use loose substring matching.',
);

// The rank payload is deliberately aggregate-only: the public type has no names, emails, IDs, or peer XP.
assert(!Object.keys(b ?? {}).some((key) => /name|email|student|xp/i.test(key) && key !== 'topPercent'), 'Rank output leaked peer data.');

console.log('University rank regressions passed.');
