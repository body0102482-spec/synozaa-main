import { calculateGlobalRank } from '../src/services/universityRankService.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const students = [
  { id: 'a', totalXp: 1000, createdAt: new Date('2026-01-01') },
  { id: 'b', totalXp: 1000, createdAt: new Date('2026-01-02') },
  { id: 'c', totalXp: 900, createdAt: new Date('2026-01-03') },
];
assert(calculateGlobalRank('a', students)?.rank === 1, 'First tied student should rank #1.');
assert(calculateGlobalRank('b', students)?.rank === 2, 'Second tied student should rank #2.');
assert(calculateGlobalRank('c', students)?.rank === 3, 'Lower XP student should rank #3.');

const tiedStudents = Array.from({ length: 10 }, (_, index) => ({
  id: `student-${index}`,
  totalXp: 500,
  createdAt: new Date(`2026-01-${String(index + 1).padStart(2, '0')}`),
}));
const tiedRanks = tiedStudents.map((student) => calculateGlobalRank(student.id, tiedStudents)?.rank);
assert(new Set(tiedRanks).size === 10, 'Equal XP students must have unique ranks.');
assert(tiedRanks.every((rank, index) => rank === index + 1), 'Equal XP students must receive sequential ranks.');

const promoted = [...students, { id: 'new-top', totalXp: 1200, createdAt: new Date('2026-09-24') }];
assert(calculateGlobalRank('new-top', promoted)?.rank === 1, 'A new highest-XP student must become #1.');
assert(calculateGlobalRank('a', promoted)?.rank === 2, 'Existing students must shift down after a new #1 joins.');

const afterGain = [
  { id: 'a', totalXp: 1000, createdAt: new Date('2026-01-01') },
  { id: 'b', totalXp: 1100, createdAt: new Date('2026-01-02') },
  { id: 'c', totalXp: 900, createdAt: new Date('2026-01-03') },
];
assert(calculateGlobalRank('b', afterGain)?.rank === 1, 'A student who gains XP past another must become #1.');
assert(calculateGlobalRank('a', afterGain)?.rank === 2, 'The passed student must move down.');

const zeroXp = [
  { id: 'zero-a', totalXp: 0, createdAt: new Date('2026-01-01') },
  { id: 'zero-b', totalXp: 0, createdAt: new Date('2026-01-02') },
];
assert(calculateGlobalRank('zero-a', zeroXp)?.rank === 1, 'Zero XP students must still be ranked.');
assert(calculateGlobalRank('zero-b', zeroXp)?.rank === 2, 'Zero XP ties must still be unique.');
assert(calculateGlobalRank('missing', students) === null, 'Unknown students must not receive a rank.');

console.log('Global rank regressions passed.');
