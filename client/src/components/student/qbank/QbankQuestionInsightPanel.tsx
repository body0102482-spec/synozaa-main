import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleX,
  Clock,
  Crosshair,
  Lightbulb,
  Network,
  Stethoscope,
  Tag,
} from 'lucide-react';
import type { QbankQuestion } from '../../../data/qbankMock';
import { resolveQbankQuestionMeta } from '../../../lib/qbankQuestionMeta';

type Props = {
  question: QbankQuestion;
  selectedIndex?: number | null;
  revealed?: boolean;
  aside?: boolean;
  /** When true, start expanded (report / review flows). */
  defaultOpen?: boolean;
  className?: string;
};

function SectionBlock({
  title,
  icon: Icon,
  iconClass,
  titleClass,
  children,
}: {
  title: string;
  icon: typeof Lightbulb;
  iconClass: string;
  titleClass: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className={`text-sm font-bold flex items-center gap-2 ${titleClass}`}>
        <Icon size={16} className={`shrink-0 ${iconClass}`} strokeWidth={2.25} />
        <span>{title}:</span>
      </p>
      <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed ps-7">
        {children}
      </div>
    </div>
  );
}

function MetaCell({
  icon: Icon,
  label,
  value,
  valueClass = 'text-slate-800 dark:text-slate-100',
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2.5 min-w-0">
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className={`text-sm font-bold break-words ${valueClass}`}>{value}</p>
    </div>
  );
}

export function QbankQuestionInsightPanel({
  question,
  selectedIndex = null,
  revealed = false,
  aside = false,
  defaultOpen = false,
  className = '',
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const meta = resolveQbankQuestionMeta(question);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [question.id, defaultOpen, revealed]);

  const correctIndex = question.correctIndex;
  const isCorrect = revealed && correctIndex != null && selectedIndex === correctIndex;
  const isUnanswered = revealed && (selectedIndex == null || correctIndex == null);

  const yourLetter =
    selectedIndex != null ? String.fromCharCode(65 + selectedIndex) : '—';
  const correctLetter =
    correctIndex != null ? String.fromCharCode(65 + correctIndex) : '—';

  const dash = '—';

  return (
    <div className={`${aside ? 'lg:sticky lg:top-4' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-3 text-sm font-semibold text-violet-800 dark:text-violet-200 hover:border-violet-400 dark:hover:border-violet-500 transition-colors"
      >
        <span>{open ? t('portalMcqHideInsight') : t('portalMcqShowInsight')}</span>
        <ChevronDown size={18} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/95 p-4 sm:p-5 space-y-5 shadow-sm">
          {revealed && (
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="space-y-1.5 text-sm">
                <p>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {t('portalMcqYourAnswer')}:{' '}
                  </span>
                  <span
                    className={`font-bold ${
                      isCorrect
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isUnanswered
                          ? 'text-slate-500'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {yourLetter}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {t('portalMcqCorrectAnswer')}:{' '}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {correctLetter}
                  </span>
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${
                  isCorrect
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : isUnanswered
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                }`}
              >
                {isCorrect ? <CheckCircle2 size={14} /> : isUnanswered ? null : <CircleX size={14} />}
                {isCorrect
                  ? t('portalMcqAnswerStatusCorrect')
                  : isUnanswered
                    ? t('portalMcqAnswerStatusUnanswered')
                    : t('portalMcqAnswerStatusIncorrect')}
              </span>
            </div>
          )}

          <SectionBlock
            title={t('portalMcqExplanation')}
            icon={BookOpen}
            iconClass="text-sky-600 dark:text-sky-400"
            titleClass="text-sky-700 dark:text-sky-300"
          >
            {meta.explanation || dash}
          </SectionBlock>

          {!meta.explanation && !meta.learningPoint && !meta.highYieldPearl && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
              {t('portalMcqInsightMissingData')}
            </p>
          )}

          <SectionBlock
            title={t('portalMcqLearningPoint')}
            icon={Crosshair}
            iconClass="text-emerald-600 dark:text-emerald-400"
            titleClass="text-emerald-700 dark:text-emerald-300"
          >
            {meta.learningPoint || dash}
          </SectionBlock>

          <SectionBlock
            title={t('portalMcqHighYieldPearl')}
            icon={Lightbulb}
            iconClass="text-amber-500 dark:text-amber-400"
            titleClass="text-amber-700 dark:text-amber-300"
          >
            {meta.highYieldPearl || dash}
          </SectionBlock>

          <SectionBlock
            title={t('portalMcqTags')}
            icon={Tag}
            iconClass="text-violet-600 dark:text-violet-400"
            titleClass="text-violet-700 dark:text-violet-300"
          >
            {meta.tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-violet-100 dark:bg-violet-950/40 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800 dark:text-violet-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              dash
            )}
          </SectionBlock>

          <SectionBlock
            title={t('portalMcqSystem')}
            icon={Stethoscope}
            iconClass="text-teal-600 dark:text-teal-400"
            titleClass="text-teal-700 dark:text-teal-300"
          >
            {meta.system || dash}
          </SectionBlock>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <MetaCell
              icon={Clock}
              label={t('portalMcqEstimatedTime')}
              value={meta.estimatedTime || dash}
            />
            <MetaCell
              icon={Network}
              label={t('portalMcqBloomLevel')}
              value={meta.bloomLevel || dash}
              valueClass="text-fuchsia-700 dark:text-fuchsia-300"
            />
            <MetaCell
              icon={BookOpen}
              label={t('portalMcqSource')}
              value={meta.source || dash}
            />
          </div>
        </div>
      )}
    </div>
  );
}
