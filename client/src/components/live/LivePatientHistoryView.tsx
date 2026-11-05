import { useTranslation } from 'react-i18next';
import { LiveVoiceStageShell, type LiveVoiceCallControls } from './LiveVoiceStageShell';

export interface LivePatientHistoryViewProps {
  patientName: string;
  patientAge: number | string;
  patientGender: string;
  call: LiveVoiceCallControls;
  error?: string;
  sessionLocked?: boolean;
}

/**
 * LIVE_VOICE only — voice-only patient/history interface.
 * There is no text chat and no text input; the conversation with the
 * simulated patient happens exclusively over the Gemini Live call.
 */
export function LivePatientHistoryView({
  patientName,
  patientAge,
  patientGender,
  call,
  error,
  sessionLocked = false,
}: LivePatientHistoryViewProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 min-h-0">
      <div className="card flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Patient identity header */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-950/60 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-black text-sky-700 dark:text-sky-300 uppercase">
              {patientName.slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{patientName}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {patientAge} {isAr ? 'سنة' : 'yo'} · {patientGender}
            </p>
          </div>
        </div>

        <LiveVoiceStageShell
          aiIcon="patient"
          aiName={patientName}
          call={call}
          error={error}
          disabled={sessionLocked}
          startHint={t('liveVoicePatientHint')}
        />
      </div>
    </div>
  );
}
