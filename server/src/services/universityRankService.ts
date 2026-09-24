import { prisma } from '../lib/prisma.js';

export type GlobalRank = {
  rank: number;
  cohortSize: number;
  higherCount: number;
  topPercent: number;
};

type RankCandidate = {
  id: string;
  totalXp: number;
  createdAt: Date;
};

export type GlobalRankUser = RankCandidate & {
  role: string;
};

export function calculateGlobalRank(currentUserId: string, candidates: RankCandidate[]): GlobalRank | null {
  const ordered = [...candidates].sort(
    (a, b) =>
      b.totalXp - a.totalXp ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const rankIndex = ordered.findIndex((candidate) => candidate.id === currentUserId);
  if (rankIndex < 0) return null;

  const rank = rankIndex + 1;
  return {
    rank,
    cohortSize: ordered.length,
    higherCount: rankIndex,
    topPercent: Math.max(1, Math.ceil((rank / ordered.length) * 100)),
  };
}

/** Returns only the requesting student's aggregate global rank. */
export async function getGlobalRank(userId: string): Promise<GlobalRank | null> {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, totalXp: true, createdAt: true },
  });
  return calculateGlobalRank(userId, students);
}
