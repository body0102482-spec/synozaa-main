import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Layers,
  Library,
  Play,
  SlidersHorizontal,
  Star,
  Target,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { QbankHeroIllustration } from '../../components/student/QbankHeroIllustration';
import type { QbankTerm } from '../../data/qbankMock';
import { QBANK } from '../../lib/qbankTheme';
import api from '../../lib/api';

const FEATURES: Array<{
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  iconBg: string;
  iconColor: string;
}> = [
  {
    icon: BookMarked,
    titleKey: 'portalMcqFeatureSources',
    descKey: 'portalMcqFeatureSourcesDesc',
    iconBg: 'bg-[#EEF0FF] dark:bg-violet-950/50',
    iconColor: 'text-[#635BFF]',
  },
  {
    icon: Target,
    titleKey: 'portalMcqFeatureSmartExams',
    descKey: 'portalMcqFeatureSmartExamsDesc',
    iconBg: 'bg-blue-50 dark:bg-blue-950/40',
    iconColor: 'text-blue-500',
  },
  {
    icon: BarChart3,
    titleKey: 'portalMcqFeatureTrack',
    descKey: 'portalMcqFeatureTrackDesc',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: 'text-emerald-500',
  },
  {
    icon: Star,
    titleKey: 'portalMcqFeatureMaster',
    descKey: 'portalMcqFeatureMasterDesc',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-500',
  },
];

const STEPS: Array<{
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  iconBg: string;
  iconColor: string;
}> = [
  {
    icon: BookOpen,
    titleKey: 'portalMcqStep1Title',
    descKey: 'portalMcqStep1Desc',
    iconBg: 'bg-[#EEF0FF] dark:bg-violet-950/50',
    iconColor: 'text-[#635BFF]',
  },
  {
    icon: Layers,
    titleKey: 'portalMcqStep2Title',
    descKey: 'portalMcqStep2Desc',
    iconBg: 'bg-blue-50 dark:bg-blue-950/40',
    iconColor: 'text-blue-500',
  },
  {
    icon: SlidersHorizontal,
    titleKey: 'portalMcqStep3Title',
    descKey: 'portalMcqStep3Desc',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconColor: 'text-emerald-500',
  },
  {
    icon: Play,
    titleKey: 'portalMcqStep4Title',
    descKey: 'portalMcqStep4Desc',
    iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-500',
  },
];

function TermCard({
  term,
  isAr,
  t,
}: {
  term: QbankTerm & { progress: number; enabled: boolean };
  isAr: boolean;
  t: (key: string) => string;
}) {
  const title = isAr ? term.titleAr : term.titleEn;

  const content = (
    <>
      {/* Row 1: calendar icon + term number (side by side) */}
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#EEF0FF] dark:bg-violet-950/50"
        >
          <CalendarDays size={20} style={{ color: QBANK.primary }} strokeWidth={1.75} />
        </div>
        <p className="text-[2rem] sm:text-[2.125rem] font-black leading-none" style={{ color: QBANK.primary }}>
          {term.id}
        </p>
      </div>

      {/* Row 2: semester title — full width below */}
      <p className="mt-2.5 font-bold text-[15px] leading-snug text-slate-900 dark:text-slate-100">
        {title}
      </p>

      {/* Row 3: stats — two columns with icon boxes */}
      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#EEF0FF] dark:bg-violet-950/50"
          >
            <Library size={16} style={{ color: QBANK.primary }} strokeWidth={1.75} />
          </div>
          <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">
            <span className="font-bold text-[13px] text-slate-900 dark:text-slate-100">
              {term.modules}
            </span>{' '}
            {t('portalMcqModules')}
          </p>
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#EEF0FF] dark:bg-violet-950/50"
          >
            <Trophy size={16} style={{ color: QBANK.primary }} strokeWidth={1.75} />
          </div>
          <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">
            <span className="font-bold text-[13px] text-slate-900 dark:text-slate-100">
              {term.questions.toLocaleString()}
            </span>{' '}
            {t('portalMcqQuestions')}
          </p>
        </div>
      </div>

      {/* Row 4–5: progress label + action/percent, then bar */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('portalMcqProgress')}
          </span>
          {term.enabled ? (
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(99,91,255,0.35)]"
              style={{ backgroundColor: QBANK.primary }}
              aria-hidden
            >
              <ChevronRight size={18} className="text-white" strokeWidth={2.5} />
            </span>
          ) : (
            <span className="text-sm font-bold shrink-0" style={{ color: QBANK.primary }}>
              {term.progress}%
            </span>
          )}
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${term.progress}%`, backgroundColor: QBANK.primary }}
          />
        </div>
      </div>
    </>
  );

  const cardClass =
    'block text-start rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-5 sm:p-6 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-none';

  if (term.enabled) {
    return (
      <Link
        to={`/student/mcq/${term.id}`}
        className={`${cardClass} hover:border-[#C7C2FF] dark:hover:border-violet-700 hover:shadow-[0_4px_24px_rgba(99,91,255,0.12)]`}
      >
        {content}
      </Link>
    );
  }

  return <div className={`${cardClass} opacity-95`}>{content}</div>;
}

function FeatureIconBox({ icon: Icon, iconBg, iconColor }: { icon: LucideIcon; iconBg: string; iconColor: string }) {
  return (
    <div className={`w-11 h-11 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
      <Icon size={22} strokeWidth={1.75} />
    </div>
  );
}

function StepIconCircle({ icon: Icon, iconBg, iconColor }: { icon: LucideIcon; iconBg: string; iconColor: string }) {
  return (
    <div className={`w-12 h-12 rounded-full ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
      <Icon size={22} strokeWidth={1.75} />
    </div>
  );
}

export default function StudentMcqPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [terms, setTerms] = useState<Array<QbankTerm & { progress: number; enabled: boolean }>>([]);

  useEffect(() => {
    api.get('/student/qbank/terms')
      .then((res) => {
        setTerms(
          (res.data.terms as QbankTerm[]).map((term) => ({
            ...term,
            progress: 0,
            enabled: term.modules > 0,
          })),
        );
      })
      .catch(() => setTerms([]));
  }, []);

  return (
    <div className="max-w-[1100px] mx-auto space-y-10 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pt-1">
        <div className="max-w-lg">
          <h1 className="text-[2rem] sm:text-[2.5rem] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            {t('portalMcqTitle')}
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t('portalMcqLandingDesc')}
          </p>
        </div>
        <QbankHeroIllustration />
      </div>

      <section>
        <h2 className="text-base font-bold mb-4 text-slate-900 dark:text-slate-100">
          {t('portalMcqSelectTerm')}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {terms.map((term) => (
            <TermCard key={term.id} term={term} isAr={!!isAr} t={t} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 pt-2">
        {FEATURES.map(({ icon, titleKey, descKey, iconBg, iconColor }) => (
          <div key={titleKey} className="flex gap-3 items-start">
            <FeatureIconBox icon={icon} iconBg={iconBg} iconColor={iconColor} />
            <div className="min-w-0">
              <p className="font-bold text-sm mb-1 text-slate-900 dark:text-slate-100">
                {t(titleKey)}
              </p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {t(descKey)}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-none">
        <h2 className="text-base font-bold mb-8 text-slate-900 dark:text-slate-100">
          {t('portalMcqHowItWorks')}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4 relative">
          {STEPS.map(({ icon, titleKey, descKey, iconBg, iconColor }, index) => (
            <div key={titleKey} className="relative text-center lg:text-start">
              {index < STEPS.length - 1 && (
                <div
                  className="hidden lg:block absolute top-5 start-[calc(50%+28px)] w-[calc(100%-56px)] border-t-2 border-dashed border-slate-200 dark:border-slate-700"
                  aria-hidden
                />
              )}
              <div className="mx-auto lg:mx-0 mb-3 relative z-10 inline-flex">
                <StepIconCircle icon={icon} iconBg={iconBg} iconColor={iconColor} />
              </div>
              <p className="font-bold text-sm mb-1 text-slate-900 dark:text-slate-100">
                {index + 1}. {t(titleKey)}
              </p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {t(descKey)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs sm:text-sm pt-2 pb-4 text-slate-500 dark:text-slate-400">
        {t('portalMcqFooter')}
      </p>
    </div>
  );
}
