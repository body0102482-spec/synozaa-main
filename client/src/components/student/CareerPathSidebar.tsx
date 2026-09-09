import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CLINICAL_RANKS, rankLabel } from '../../lib/clinicalRanks';
import type { RankSnapshot } from './XpBreakdownSection';
import type { UniversityRankSnapshot } from './StudentPortalLayout';

function formatXp(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface CareerPathSidebarProps {
  progress: RankSnapshot;
  isAr: boolean;
  selectedKey: string | null;
  universityRank?: UniversityRankSnapshot | null;
}

export function CareerPathSidebar({ progress, isAr, selectedKey, universityRank }: CareerPathSidebarProps) {
  const { t } = useTranslation();

  const selectedRank = useMemo(() => {
    const key = selectedKey ?? progress.currentRank.key;
    return CLINICAL_RANKS.find((r) => r.key === key) ?? progress.currentRank;
  }, [progress.currentRank, selectedKey]);

  const level = CLINICAL_RANKS.findIndex((r) => r.key === progress.currentRank.key) + 1;
  const selectedLevel = CLINICAL_RANKS.findIndex((r) => r.key === selectedRank.key) + 1;

  return (
    <aside className="flex flex-col gap-4 border-t lg:border-t-0 lg:border-s border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {t('xpBoardStatus')}
        </p>
        {universityRank ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mt-1">
            University Rank
          </p>
        ) : (
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mt-1">
            {t('xpCommissionStanding')}
          </p>
        )}

        {universityRank && (
          <div className="mt-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
                #{universityRank.rank}{universityRank.cohortSize === 1 ? ' in your university' : ''}
              </p>
              {universityRank.cohortSize > 1 && (
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Top {universityRank.topPercent}% in your university
                </p>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {universityRank.higherCount === 0
                ? 'You are currently at the top of your university cohort.'
                : `${universityRank.higherCount} student${universityRank.higherCount === 1 ? '' : 's'} ahead of you.`}
            </p>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black">
              {t('xpRankLevel')} {level}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 dark:text-white leading-snug">
                {rankLabel(progress.currentRank, isAr)}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-1">
                {t('xpCurrentActiveRank')}
              </p>
            </div>
          </div>

          {progress.nextRank ? (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {t('xpNextMilestone')}: {rankLabel(progress.nextRank, isAr).toUpperCase()}
              </p>
              <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-700"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {formatXp(progress.totalXp)} XP · {progress.progressPercent}% {t('xpTowardNextRank')}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t('xpMaxRank')}</p>
          )}
        </div>
      </div>

      {selectedRank.key !== progress.currentRank.key && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            {t('xpRankLevel')} {selectedLevel}
          </p>
          <p className="font-semibold text-slate-900 dark:text-white mt-1">{rankLabel(selectedRank, isAr)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {selectedRank.minXp.toLocaleString()} XP {t('xpRankThreshold')}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3">
          {t('xpMapLegend')}
        </p>
        <ul className="space-y-3 text-xs">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-teal-700" />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{t('xpMapLegendCompleted')}</p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">{t('xpMapLegendCompletedDesc')}</p>
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white font-bold">
              #
            </span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{t('xpMapLegendCurrent')}</p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">{t('xpMapLegendCurrentDesc')}</p>
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-slate-200 dark:bg-slate-600" />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{t('xpMapLegendLocked')}</p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">{t('xpMapLegendLockedDesc')}</p>
            </div>
          </li>
        </ul>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 mt-auto">{t('xpMapTapHint')}</p>
    </aside>
  );
}
