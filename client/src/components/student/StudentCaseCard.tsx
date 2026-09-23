import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Lock, Play } from 'lucide-react';

export interface OsceCaseSummary {
  id: string;
  titleEn: string;
  titleAr: string;
  chiefComplaint: string;
  isFreeTier?: boolean;
  specialty?: { nameEn: string; nameAr: string };
  difficulty?: { nameEn: string; nameAr: string; level: number };
  examImages?: string;
}

const DEFAULT_COVER = '/exam/chest-inspection.svg';

function getCaseCover(examImages?: string): string {
  try {
    const images = JSON.parse(examImages || '[]') as Array<{ url?: string }>;
    return images.find((image) => image.url?.startsWith('http') || image.url?.startsWith('/'))?.url ?? DEFAULT_COVER;
  } catch {
    return DEFAULT_COVER;
  }
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
  const specialty = caseData.specialty ? (isAr ? caseData.specialty.nameAr : caseData.specialty.nameEn) : null;
  const difficulty = caseData.difficulty ? (isAr ? caseData.difficulty.nameAr : caseData.difficulty.nameEn) : null;
  const [coverImage, setCoverImage] = useState(() => getCaseCover(caseData.examImages));
  const isSvg = coverImage.endsWith('.svg');

  useEffect(() => {
    setCoverImage(getCaseCover(caseData.examImages));
  }, [caseData.examImages]);

  return (
    <article
      className={`rounded-2xl border overflow-hidden shadow-sm flex flex-col h-full ${
        lockedByPlan
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 opacity-90'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:shadow-md transition-shadow'
      }`}
    >
      <div className="h-44 bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
        <img
          src={coverImage}
          alt={title}
          className={`w-full h-full ${isSvg ? 'object-contain p-3 bg-slate-100 dark:bg-slate-800' : 'object-cover'}`}
          onError={() => {
            if (coverImage !== DEFAULT_COVER) setCoverImage(DEFAULT_COVER);
          }}
        />
        <div className="absolute top-3 start-3 flex gap-2">
          {difficulty && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white bg-teal-700">
              {difficulty}
            </span>
          )}
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900/70 text-white flex items-center gap-1">
            <Clock size={10} />
            18 {t('portalMins')}
          </span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4 min-h-0">
        <div className="flex-1 min-h-0">
          {lockedByPlan && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-[0.12em] mb-3">
              <Lock size={11} />
              {t('portalCaseLocked')}
            </span>
          )}
          {specialty && <p className="text-[10px] font-bold tracking-[0.12em] text-teal-600 dark:text-teal-400 uppercase mb-2">{specialty}</p>}
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
