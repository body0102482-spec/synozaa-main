import { prisma } from '../lib/prisma.js';

export const XP_MAX_PER_CASE = 50;
export const XP_REPEAT_MULTIPLIER = 0.5;
export const EXCELLENT_HISTORY_THRESHOLD = 75;

export const CLINICAL_RANKS = [
  { key: 'medical_student', minXp: 0, emoji: '🎓', nameEn: 'Medical Student', nameAr: 'طالب طب' },
  { key: 'clinical_clerk', minXp: 500, emoji: '🩺', nameEn: 'Clinical Clerk', nameAr: 'Clinical Clerk' },
  { key: 'intern_doctor', minXp: 1500, emoji: '🏥', nameEn: 'Intern Doctor', nameAr: 'طبيب امتياز' },
  { key: 'junior_resident', minXp: 3000, emoji: '👨‍⚕️', nameEn: 'Junior Resident', nameAr: 'Junior Resident' },
  { key: 'resident', minXp: 5000, emoji: '👨‍⚕️', nameEn: 'Resident', nameAr: 'Resident' },
  { key: 'senior_resident', minXp: 8000, emoji: '⭐', nameEn: 'Senior Resident', nameAr: 'Senior Resident' },
  { key: 'registrar', minXp: 11000, emoji: '📋', nameEn: 'Registrar', nameAr: 'Registrar' },
  { key: 'specialist', minXp: 14000, emoji: '🩻', nameEn: 'Specialist', nameAr: 'Specialist' },
  { key: 'senior_specialist', minXp: 17000, emoji: '🏅', nameEn: 'Senior Specialist', nameAr: 'Senior Specialist' },
  { key: 'consultant', minXp: 20000, emoji: '👑', nameEn: 'Consultant', nameAr: 'Consultant' },
] as const;

export type ClinicalRank = (typeof CLINICAL_RANKS)[number];

export type XpBreakdownLine = {
  key:
    | 'caseCompletion'
    | 'overallPerformance'
    | 'examinerQuestions'
    | 'excellentHistoryCommunication';
  points: number;
  maxPoints?: number;
};

export type RankProgress = {
  currentRank: ClinicalRank;
  nextRank: ClinicalRank | null;
  totalXp: number;
  xpInCurrentRank: number;
  xpNeededForNext: number;
  progressPercent: number;
  previousRank?: ClinicalRank;
  promoted?: boolean;
  promotedRank?: ClinicalRank | null;
};

export type SessionXpResult = {
  breakdown: XpBreakdownLine[];
  calculatedXp: number;
  awardedXp: number;
  isRepeat: boolean;
  rankProgress: RankProgress;
};

type ScoreInput = {
  totalScore: number;
  communicationScore: number;
  historyTakingScore: number;
  clinicalReasonScore: number;
  organizationScore: number;
  closingScore: number;
};

function roundXp(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Overall OSCE score (0–100) → 0–20 XP */
function overallPerformanceXp(totalScore: number) {
  return roundXp(clamp(totalScore, 0, 100) * 0.2);
}

/** Examiner viva accuracy (exam + diagnosis answers) → 0–10 XP */
function examinerQuestionsXp(clinicalReasonScore: number, closingScore: number) {
  const accuracy = (clinicalReasonScore + closingScore) / 2;
  return roundXp(clamp(accuracy, 0, 100) * 0.1);
}

/** Excellent history + communication (avg ≥ 75) → +10 XP, else 0 */
function excellentHistoryXp(historyTakingScore: number, communicationScore: number) {
  const avg = (historyTakingScore + communicationScore) / 2;
  return avg >= EXCELLENT_HISTORY_THRESHOLD ? 10 : 0;
}

export function calculateXpBreakdown(scores: ScoreInput): XpBreakdownLine[] {
  const lines: XpBreakdownLine[] = [
    { key: 'caseCompletion', points: 10, maxPoints: 10 },
    {
      key: 'overallPerformance',
      points: overallPerformanceXp(scores.totalScore),
      maxPoints: 20,
    },
    {
      key: 'examinerQuestions',
      points: examinerQuestionsXp(scores.clinicalReasonScore, scores.closingScore),
      maxPoints: 10,
    },
    {
      key: 'excellentHistoryCommunication',
      points: excellentHistoryXp(scores.historyTakingScore, scores.communicationScore),
      maxPoints: 10,
    },
  ];

  return lines.map((line) => ({
    ...line,
    points: Math.max(0, line.points),
  }));
}

export function sumBreakdown(breakdown: XpBreakdownLine[]) {
  const total = breakdown.reduce((sum, line) => sum + line.points, 0);
  return roundXp(Math.min(XP_MAX_PER_CASE, total));
}

export function getRankProgress(totalXp: number): RankProgress {
  const xp = Math.max(0, totalXp);
  let currentIndex = 0;
  for (let i = CLINICAL_RANKS.length - 1; i >= 0; i -= 1) {
    if (xp >= CLINICAL_RANKS[i].minXp) {
      currentIndex = i;
      break;
    }
  }

  const currentRank = CLINICAL_RANKS[currentIndex];
  const nextRank = CLINICAL_RANKS[currentIndex + 1] ?? null;
  const xpInCurrentRank = xp - currentRank.minXp;
  const xpNeededForNext = nextRank ? nextRank.minXp - xp : 0;
  const span = nextRank ? nextRank.minXp - currentRank.minXp : 1;
  const progressPercent = nextRank
    ? Math.min(100, Math.round((xpInCurrentRank / span) * 1000) / 10)
    : 100;

  return {
    currentRank,
    nextRank,
    totalXp: xp,
    xpInCurrentRank,
    xpNeededForNext: Math.max(0, xpNeededForNext),
    progressPercent,
  };
}

export async function isRepeatCaseCompletion(userId: string, caseId: string, sessionId: string) {
  const prior = await prisma.session.count({
    where: {
      userId,
      caseId,
      id: { not: sessionId },
      status: 'COMPLETED',
      result: { isNot: null },
    },
  });
  return prior > 0;
}

export async function applySessionXp(
  userId: string,
  sessionId: string,
  caseId: string,
  scores: ScoreInput,
): Promise<SessionXpResult> {
  const userBefore = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalXp: true },
  });
  const rankBefore = getRankProgress(userBefore?.totalXp ?? 0);

  const breakdown = calculateXpBreakdown(scores);
  const calculatedXp = sumBreakdown(breakdown);
  const isRepeat = await isRepeatCaseCompletion(userId, caseId, sessionId);
  const awardedXp = roundXp(calculatedXp * (isRepeat ? XP_REPEAT_MULTIPLIER : 1));

  const user = await prisma.user.update({
    where: { id: userId },
    data: { totalXp: { increment: awardedXp } },
    select: { totalXp: true },
  });

  const rankAfter = getRankProgress(user.totalXp);
  const promoted = rankAfter.currentRank.minXp > rankBefore.currentRank.minXp;

  const rankProgress: RankProgress = {
    ...rankAfter,
    previousRank: rankBefore.currentRank,
    promoted,
    promotedRank: promoted ? rankAfter.currentRank : null,
  };

  return {
    breakdown,
    calculatedXp,
    awardedXp,
    isRepeat,
    rankProgress,
  };
}
