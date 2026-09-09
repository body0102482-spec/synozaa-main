import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CLINICAL_RANKS, rankLabel } from '../../lib/clinicalRanks';
import type { RankSnapshot } from './XpBreakdownSection';
import { CareerPathMap } from './CareerPathMap';
import { CareerPathSidebar } from './CareerPathSidebar';
import type { UniversityRankSnapshot } from './StudentPortalLayout';

function formatXp(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Compact list — used on feedback / XP breakdown screens. */
export function CareerPathList({ progress, isAr }: { progress: RankSnapshot; isAr: boolean }) {
  const { t } = useTranslation();
  const currentMin = progress.currentRank.minXp;

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3">
        {t('xpCareerPath')}
      </p>
      <ol className="space-y-2">
        {CLINICAL_RANKS.map((rank) => {
          const achieved = progress.totalXp >= rank.minXp;
          const isCurrent = rank.minXp === currentMin;
          return (
            <li
              key={rank.key}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                isCurrent
                  ? 'bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800'
                  : achieved
                    ? 'bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                    : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span className={`font-medium ${isCurrent ? 'text-teal-800 dark:text-teal-200' : ''}`}>
                {rankLabel(rank, isAr)}
              </span>
              <span className="text-xs font-semibold shrink-0">
                {rank.minXp.toLocaleString()} XP
                {isCurrent && (
                  <span className="ms-2 text-[10px] uppercase text-teal-600 dark:text-teal-400">
                    {t('xpCurrentRankBadge')}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RankProgressSummary({ progress, isAr }: { progress: RankSnapshot; isAr: boolean }) {
  const { t } = useTranslation();
  const rankName = (rank: RankSnapshot['currentRank']) => rankLabel(rank, isAr);

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 gap-2">
        <span className="font-semibold text-slate-800 dark:text-slate-200">{rankName(progress.currentRank)}</span>
        {progress.nextRank && (
          <span>
            {t('xpNextRank')}: {rankName(progress.nextRank)}
          </span>
        )}
      </div>
      {progress.nextRank ? (
        <>
          <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-700"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {progress.progressPercent}% {t('xpTowardNextRank')} · {formatXp(progress.totalXp)} XP
          </p>
        </>
      ) : (
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t('xpMaxRank')}</p>
      )}
    </div>
  );
}

export function CareerPathSection({
  progress,
  isAr,
  universityRank,
}: {
  progress: RankSnapshot;
  isAr: boolean;
  universityRank?: UniversityRankSnapshot | null;
}) {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string | null>(progress.currentRank.key);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-sm overflow-hidden">
      <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          {t('xpCareerPath')}
        </p>
        <h2 className="font-bold text-slate-900 dark:text-white mt-1">{t('xpRankProgressTitle')}</h2>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <CareerPathMap
          progress={progress}
          isAr={isAr}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
        />
        <CareerPathSidebar
          progress={progress}
          isAr={isAr}
          selectedKey={selectedKey}
          universityRank={universityRank}
        />
      </div>
    </div>
  );
}
