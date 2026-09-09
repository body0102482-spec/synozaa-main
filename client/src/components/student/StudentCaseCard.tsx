import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Play } from 'lucide-react';

export interface OsceCaseSummary {
  id: string;
  titleEn: string;
  titleAr: string;
  chiefComplaint: string;
  isFreeTier?: boolean;
}

interface StudentCaseCardProps {
  caseData: OsceCaseSummary;
  isAr: boolean;
  isFreeUser: boolean;
  canStart: boolean;
  attemptLabel?: string | null;
  onStart: (caseId: string) => void;
}

export function StudentCaseCard({
  caseData,
  isAr,
  isFreeUser,
  canStart,
  attemptLabel,
  onStart,
}: StudentCaseCardProps) {
  const { t } = useTranslation();
  const title = isAr ? caseData.titleAr : caseData.titleEn;
  const lockedByPlan = isFreeUser && !caseData.isFreeTier;

  return (
    <article
      className={`rounded-2xl border overflow-hidden shadow-sm flex flex-col h-full ${
        lockedByPlan
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 opacity-90'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:shadow-md transition-shadow'
      }`}
    >
      <div className="p-5 flex-1 flex flex-col gap-4 min-h-0">
        <div className="flex-1 min-h-0">
          {lockedByPlan && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-[0.12em] mb-3">
              <Lock size={11} />
              {t('portalCaseLocked')}
            </span>
          )}
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{caseData.chiefComplaint}</p>
          {attemptLabel && !lockedByPlan && (
            <p className={`text-xs font-semibold mt-2 ${canStart ? 'text-teal-600 dark:text-teal-400' : 'text-red-500 dark:text-red-400'}`}>
              {attemptLabel}
            </p>
          )}
        </div>

        {lockedByPlan ? (
          <Link
            to="/student/upgrade"
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-900 transition-colors mt-auto shrink-0"
          >
            <Lock size={14} />
            {t('portalUpgradeToUnlock')}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onStart(caseData.id)}
            disabled={!canStart}
            className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 mt-auto shrink-0 ${
              canStart
                ? 'bg-gradient-to-r from-slate-800 to-teal-800 text-white hover:opacity-95'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {canStart ? <Play size={14} fill="currentColor" /> : <Lock size={14} />}
            {canStart ? t('portalOpenSimulator') : t('attemptsUsedUp')}
          </button>
        )}
      </div>
    </article>
  );
}
