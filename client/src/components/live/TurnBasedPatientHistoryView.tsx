import { Loader2, Mic, Square, UserCircle, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OpenRouterPatientAudioControls } from '../../hooks/useOpenRouterPatientAudio';

interface TurnBasedPatientHistoryViewProps {
  patientName: string;
  patientAge: number | string;
  patientGender: string;
  call: OpenRouterPatientAudioControls;
  sessionLocked?: boolean;
}

function resolveErrorMessage(code: string, t: (key: string) => string): string {
  if (code === 'insecure-context') return t('liveVoiceInsecureContext');
  if (code === 'not-allowed') return t('micPermissionDenied');
  if (code === 'no-microphone') return t('liveVoiceNoMicrophone');
  if (code === 'mic-in-use') return t('liveVoiceMicInUse');
  if (code === 'not-supported') return t('liveCallNotSupported');
  if (code === 'recording-too-short') return t('patientAudioTooShort');
  if (code === 'openrouter-audio-unavailable' || code === 'openrouter-audio-model-unconfigured') {
    return t('patientAudioNotConfigured');
  }
  return t('patientAudioFailed');
}

export function TurnBasedPatientHistoryView({
  patientName,
  patientAge,
  patientGender,
  call,
  sessionLocked = false,
}: TurnBasedPatientHistoryViewProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith('ar');
  const errorMessage = call.error ? resolveErrorMessage(call.error, t) : '';

  if (!call.isSecure || !call.isSupported) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="max-w-md text-center text-sm text-red-600 dark:text-red-400">
          {!call.isSecure ? t('liveVoiceInsecureContext') : t('liveCallNotSupported')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 min-h-0">
      <div className="card flex flex-col flex-1 min-h-0 overflow-hidden">
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

        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-5 min-h-0 overflow-y-auto">
          <div
            className={`w-20 h-20 rounded-3xl border flex items-center justify-center ${
              call.isRecording
                ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-900'
                : 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-900'
            }`}
          >
            {call.isProcessing ? (
              <Loader2 size={38} className="text-sky-600 animate-spin" />
            ) : call.isRecording ? (
              <Mic size={38} className="text-red-600 animate-pulse" />
            ) : (
              <UserCircle size={38} className="text-sky-500" />
            )}
          </div>

          <div className="text-center max-w-lg">
            <p className="font-bold text-slate-900 dark:text-white">{patientName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {call.isRecording
                ? t('patientAudioRecording')
                : call.isProcessing
                  ? t('patientAudioProcessing')
                    : t('patientAudioHint')}
            </p>
          </div>

          {(call.studentTranscript || call.patientTranscript) && (
            <div className="w-full max-w-2xl space-y-3">
              {call.studentTranscript && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                    {t('patientAudioQuestion')}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200" dir="auto">
                    {call.studentTranscript}
                  </p>
                </div>
              )}
              {call.patientTranscript && (
                <div className="rounded-2xl border border-teal-200 dark:border-teal-900 bg-teal-50/60 dark:bg-teal-950/30 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-400 mb-1 flex items-center gap-1.5">
                    <Volume2 size={13} />
                    {t('patientAudioAnswer')}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200" dir="auto">
                    {call.patientTranscript}
                  </p>
                </div>
              )}
            </div>
          )}

          {call.audioUrl && (
            <audio
              className="w-full max-w-xl"
              controls
              autoPlay
              preload="metadata"
              src={call.audioUrl}
              aria-label={t('patientAudioPlayback')}
            />
          )}

          {errorMessage && (
            <p className="w-full max-w-xl text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-3 leading-relaxed">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="shrink-0 px-4 py-3 flex flex-col items-center gap-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={call.isRecording ? call.stopRecording : call.startRecording}
            disabled={sessionLocked || call.isProcessing}
            className={`h-12 px-6 rounded-full text-white font-bold text-sm inline-flex items-center gap-2 shadow-md transition-colors disabled:opacity-40 ${
              call.isRecording
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {call.isProcessing ? (
              <Loader2 size={17} className="animate-spin" />
            ) : call.isRecording ? (
              <Square size={16} />
            ) : (
              <Mic size={18} />
            )}
            {call.isProcessing
              ? t('patientAudioProcessing')
              : call.isRecording
                ? t('patientAudioStop')
                : t('patientAudioRecord')}
          </button>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
            {t('patientAudioPermissionHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
