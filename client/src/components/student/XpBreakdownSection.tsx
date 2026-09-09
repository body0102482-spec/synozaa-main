import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CareerPathList, RankProgressSummary } from './CareerPathSection';

export type XpBreakdownLine = {
  key: string;
  points: number;
  maxPoints?: number;
};

export type RankSnapshot = {
  currentRank: { key: string; minXp: number; emoji: string; nameEn: string; nameAr: string };
  nextRank: { key: string; minXp: number; emoji: string; nameEn: string; nameAr: string } | null;
  totalXp: number;
  xpInCurrentRank: number;
  xpNeededForNext: number;
  progressPercent: number;
  previousRank?: RankSnapshot['currentRank'];
  promoted?: boolean;
  promotedRank?: RankSnapshot['currentRank'] | null;
};

const BREAKDOWN_LABEL_KEYS: Record<string, string> = {
  caseCompletion: 'xpLineCaseCompletion',
  overallPerformance: 'xpLineOverallPerformance',
  examinerQuestions: 'xpLineExaminerQuestions',
  excellentHistoryCommunication: 'xpLineExcellentHistory',
  historyCommunication: 'xpLineExcellentHistory',
};

function formatXp(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface XpBreakdownSectionProps {
  result: Record<string, unknown>;
  rankProgress?: RankSnapshot | null;
  isAr: boolean;
}

export function XpBreakdownSection({ result, rankProgress, isAr }: XpBreakdownSectionProps) {
  const { t } = useTranslation();

  const xpApplied = Boolean(result.xpApplied);
  if (!xpApplied && !rankProgress) return null;

  const breakdown = parseJson<XpBreakdownLine[]>(result.xpBreakdown, []);
  const calculatedXp = Number(result.xpCalculated ?? 0);
  const awardedXp = Number(result.xpAwarded ?? 0);
  const isRepeat = Boolean(result.xpIsRepeat);
  const progress =
    rankProgress ?? parseJson<RankSnapshot | null>(result.xpRankSnapshot, null);

  if (!breakdown.length && !progress) return null;

  return (
    <div className="space-y-4">
      <div className="card p-5 sm:p-6 border-teal-200/60 dark:border-teal-800/50 bg-gradient-to-br from-teal-50/80 to-white dark:from-teal-950/20 dark:to-slate-900/80">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-teal-600 dark:text-teal-400" />
          <h4 className="font-bold text-slate-900 dark:text-white">{t('xpBreakdownTitle')}</h4>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('xpBreakdownHint')}</p>

        <ul className="space-y-2.5 mb-4">
          {breakdown.map((line) => (
            <li
              key={line.key}
              className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200 gap-3"
            >
              <span>{t(BREAKDOWN_LABEL_KEYS[line.key] ?? line.key)}</span>
              <span className="font-bold text-teal-700 dark:text-teal-400 shrink-0">
                +{formatXp(line.points)} XP
                {line.maxPoints != null && line.maxPoints !== line.points && (
                  <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">
                    {' '}
                    / {line.maxPoints}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="pt-3 border-t border-teal-200/60 dark:border-teal-800/40 flex items-center justify-between">
          <span className="font-semibold text-slate-900 dark:text-white">{t('xpTotalEarned')}</span>
          <span className="text-lg font-bold text-teal-700 dark:text-teal-300">
            +{formatXp(calculatedXp)} XP
            <span className="text-sm font-normal text-slate-400 ms-1">/ 50</span>
          </span>
        </div>

        {isRepeat && (
          <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-200">{t('xpRepeatTitle')}</p>
            <p className="text-amber-800/90 dark:text-amber-300/90 mt-1">{t('xpRepeatDesc')}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div>
                <p className="text-amber-700/80 dark:text-amber-400/80">{t('xpCalculated')}</p>
                <p className="font-bold text-amber-950 dark:text-amber-100">{formatXp(calculatedXp)} XP</p>
              </div>
              <div>
                <p className="text-amber-700/80 dark:text-amber-400/80">{t('xpAwarded')}</p>
                <p className="font-bold text-amber-950 dark:text-amber-100">{formatXp(awardedXp)} XP</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {progress && (
        <div className="card p-5 sm:p-6">
          <RankProgressSummary progress={progress} isAr={isAr} />
          <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-700">
            <CareerPathList progress={progress} isAr={isAr} />
          </div>

          <Link
            to="/student"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-slate-800 to-teal-800 text-white text-sm font-bold uppercase tracking-wide hover:opacity-95 transition-opacity"
          >
            {t('xpStartNewCase')}
          </Link>
        </div>
      )}
    </div>
  );
}

export function parseRankSnapshot(raw: unknown): RankSnapshot | null {
  if (typeof raw === 'object' && raw !== null) return raw as RankSnapshot;
  return parseJson<RankSnapshot | null>(raw, null);
}
