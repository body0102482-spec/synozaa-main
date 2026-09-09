import { prisma } from '../lib/prisma.js';

export type UniversityRank = {
  rank: number;
  cohortSize: number;
  higherCount: number;
  topPercent: number;
};

type RankCandidate = {
  id: string;
  totalXp: number;
};

export type UniversityRankUser = RankCandidate & {
  role: string;
  universityId: string | null;
  university: string | null;
};

/**
 * Normalization is intentionally exact (apart from harmless casing/spacing) so
 * custom "Other" universities cannot be merged through substring matching.
 */
export function normalizeUniversityName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function calculateUniversityRank(currentUserId: string, cohort: RankCandidate[]): UniversityRank | null {
  const current = cohort.find((candidate) => candidate.id === currentUserId);
  if (!current || cohort.length === 0) return null;

  // Competition ranking: 500, 400, 400, 300 becomes 1, 2, 2, 4.
  const higherCount = cohort.filter((candidate) => candidate.totalXp > current.totalXp).length;
  const rank = higherCount + 1;

  return {
    rank,
    cohortSize: cohort.length,
    higherCount,
    topPercent: Math.max(1, Math.ceil((rank / cohort.length) * 100)),
  };
}

export function selectUniversityCohort(
  current: Pick<UniversityRankUser, 'role' | 'universityId' | 'university'>,
  candidates: UniversityRankUser[],
): RankCandidate[] {
  if (current.role !== 'STUDENT') return [];

  if (current.universityId) {
    return candidates
      .filter((candidate) => candidate.role === 'STUDENT' && candidate.universityId === current.universityId)
      .map(({ id, totalXp }) => ({ id, totalXp }));
  }

  const normalizedUniversity = current.university ? normalizeUniversityName(current.university) : '';
  if (!normalizedUniversity) return [];

  return candidates
    .filter(
      (candidate) =>
        candidate.role === 'STUDENT' &&
        candidate.universityId === null &&
        candidate.university !== null &&
        normalizeUniversityName(candidate.university) === normalizedUniversity,
    )
    .map(({ id, totalXp }) => ({ id, totalXp }));
}

/** Returns only the requesting student's aggregate rank, never cohort identities or XP. */
export async function getUniversityRank(userId: string): Promise<UniversityRank | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, universityId: true, university: true },
  });

  if (!user || user.role !== 'STUDENT') return null;

  if (user.universityId) {
    const cohort = await prisma.user.findMany({
      where: { role: 'STUDENT', universityId: user.universityId },
      select: { id: true, totalXp: true, role: true, universityId: true, university: true },
    });
    return calculateUniversityRank(user.id, selectUniversityCohort(user, cohort));
  }

  const normalizedUniversity = user.university ? normalizeUniversityName(user.university) : '';
  if (!normalizedUniversity) return null;

  const customUniversityStudents = await prisma.user.findMany({
    where: { role: 'STUDENT', universityId: null, university: { not: null } },
    select: { id: true, totalXp: true, role: true, universityId: true, university: true },
  });
  const cohort = selectUniversityCohort(user, customUniversityStudents);

  return calculateUniversityRank(user.id, cohort);
}
