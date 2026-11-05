import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LiveVoiceStageShell, type LiveVoiceCallControls } from './LiveVoiceStageShell';

export interface LiveExaminerVivaViewProps {
  call: LiveVoiceCallControls;
  error?: string;
  sessionLocked?: boolean;
  /** Number of viva questions the student has answered so far (client-side estimate). */
  answeredCount: number;
  /** Total viva questions for this station. */
  totalQuestions: number;
  /** True once the examiner's closing has been persisted for this session. */
  vivaComplete: boolean;
}

/**
 * LIVE_VOICE only — voice-only Examiner/Viva interface for the history-stage
 * viva. The examiner is a distinct AI role (its own connection and system
 * instructions); there is no text chat composer and no patient persona here.
 */
export function LiveExaminerVivaView({
  call,
  error,
  sessionLocked = false,
  answeredCount,
  totalQuestions,
  vivaComplete,
}: LiveExaminerVivaViewProps) {
  const { t } = useTranslation();
  const answered = Math.min(answeredCount, totalQuestions);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 min-h-0">
      <div className="card flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Examiner header + viva progress */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200 truncate">
              {t('examinerBox')}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('vivaQuestions')}
            </p>
          </div>
          {vivaComplete ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-full px-2.5 py-1 shrink-0">
              <CheckCircle2 size={13} />
              {t('liveVivaComplete')}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {Array.from({ length: totalQuestions }, (_, index) => (
                <span
                  key={index}
                  className={`w-2 h-2 rounded-full ${index < answered ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  aria-hidden
                />
              ))}
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-1">
                {answered}/{totalQuestions}
              </p>
            </div>
          )}
        </div>

        <LiveVoiceStageShell
          aiIcon="examiner"
          aiName={t('clinicalExaminer')}
          call={call}
          error={error}
          disabled={sessionLocked || vivaComplete}
          startHint={vivaComplete ? t('liveVivaComplete') : t('liveVoiceExaminerHint')}
        />
      </div>
    </div>
  );
}
