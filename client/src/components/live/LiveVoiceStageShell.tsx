import type { ReactNode } from 'react';
import { Loader2, Mic, MicOff, Phone, PhoneOff, Shield, UserCircle, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** One active Gemini Live connection for examiner and fallback patient calls. */
export interface LiveVoiceCallControls {
  isLiveCall: boolean;
  isBusy: boolean;
  isSpeaking: boolean;
  isMicListening: boolean;
  connectionState: 'idle' | 'connecting' | 'connected' | 'error';
  micStatus: 'idle' | 'requesting-permission' | 'mic-active' | 'connecting' | 'connected' | 'failed';
  micLevel: number;
  isMuted: boolean;
  aiCaption: string;
  isSupported: boolean;
  isSecure: boolean;
  toggleLiveCall: () => void;
  toggleMute: () => void;
  stopCall: () => void;
}

export interface LiveVoiceStageShellProps {
  /** Which AI persona this connection speaks as — patient or examiner. */
  aiIcon: 'patient' | 'examiner';
  /** Display name of the AI (patient name, "Clinical Examiner", …). */
  aiName: string;
  call: LiveVoiceCallControls;
  error?: string;
  disabled?: boolean;
  /** Optional controls rendered beside mute/end (e.g. "Complete Step"). */
  extraActions?: ReactNode;
  /** Hint shown on the start-call screen. */
  startHint?: string;
}

function MicLevelBars({ level, active }: { level: number; active: boolean }) {
  return (
    <div className="flex items-end justify-center gap-1 h-8" aria-hidden>
      {[0, 1, 2, 3, 4].map((index) => {
        const wobble = active ? Math.sin(Date.now() / 90 + index) * 0.12 : 0;
        const height = Math.max(0.18, Math.min(1, level * (0.65 + 0.35 * ((index % 3) + 1) / 3) + wobble));
        return (
          <span
            key={index}
            className={`w-1.5 rounded-full transition-transform duration-100 ${active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            style={{ height: '100%', transform: `scaleY(${active ? height : 0.18})`, transformOrigin: 'bottom' }}
          />
        );
      })}
    </div>
  );
}

export function LiveVoiceStageShell({
  aiIcon,
  aiName,
  call,
  error,
  disabled = false,
  extraActions,
  startHint,
}: LiveVoiceStageShellProps) {
  const { t } = useTranslation();
  const AiIcon = aiIcon === 'patient' ? UserCircle : Shield;
  const connecting = call.isBusy && !call.isLiveCall;

  if (!call.isSecure) {
    // Browsers block getUserMedia entirely on insecure (http://) origins.
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center justify-center mx-auto">
            <MicOff size={30} className="text-red-500" />
          </div>
          <p className="font-bold text-slate-900 dark:text-white">{t('liveVoiceTitle')}</p>
          <p className="text-sm text-red-600 dark:text-red-400 font-medium leading-relaxed">
            {t('liveVoiceInsecureContext')}
          </p>
        </div>
      </div>
    );
  }

  if (!call.isSupported) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm text-center text-slate-500 dark:text-slate-400">
          <MicOff size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium">{t('liveCallNotSupported')}</p>
        </div>
      </div>
    );
  }

  if (!call.isLiveCall && !connecting) {
    const failed = call.micStatus === 'failed';
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-900 flex items-center justify-center mx-auto">
            <AiIcon size={40} className="text-sky-500" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{aiName}</p>
            {startHint && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{startHint}</p>
            )}
          </div>
          <p
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 border ${
              failed
                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${failed ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}
              aria-hidden
            />
            {failed ? t('liveVoiceStatusFailed') : t('liveVoiceStatusReady')}
          </p>
          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-2.5 text-start leading-relaxed">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={call.toggleLiveCall}
            disabled={disabled}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold shadow-md transition-colors"
          >
            <Phone size={18} />
            {t('liveVoiceStart')}
          </button>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            {t('liveVoiceMicPermissionHint')}
          </p>
        </div>
      </div>
    );
  }

  const aiSpeaking = call.isLiveCall && call.isSpeaking;
  const studentSpeaking = call.isLiveCall && call.isMicListening && !call.isMuted && call.micLevel > 0.05;

  // Explicit microphone / connection lifecycle shown to the user.
  let statusLabel = t('liveVoiceDisconnected');
  let statusClass = 'text-slate-600 dark:text-slate-300';
  let dotClass = 'bg-red-500';
  if (call.micStatus === 'requesting-permission') {
    statusLabel = t('liveVoiceStatusRequesting');
    statusClass = 'text-amber-700 dark:text-amber-300';
    dotClass = 'bg-amber-500 animate-pulse';
  } else if (call.micStatus === 'mic-active') {
    statusLabel = t('liveVoiceStatusMicActive');
    statusClass = 'text-sky-700 dark:text-sky-300';
    dotClass = 'bg-sky-500';
  } else if (call.micStatus === 'connecting') {
    statusLabel = t('liveVoiceStatusConnecting');
    statusClass = 'text-amber-700 dark:text-amber-300';
    dotClass = 'bg-amber-500 animate-pulse';
  } else if (call.micStatus === 'failed') {
    statusLabel = t('liveVoiceStatusFailed');
    statusClass = 'text-red-600 dark:text-red-400';
    dotClass = 'bg-red-500';
  } else if (call.isLiveCall && call.connectionState === 'connected') {
    if (aiSpeaking) {
      statusLabel = aiIcon === 'patient' ? t('liveVoicePatientSpeaking') : t('liveVoiceExaminerSpeaking');
      statusClass = 'text-teal-600 dark:text-teal-400';
      dotClass = 'bg-teal-500 animate-pulse';
    } else {
      statusLabel = t('liveVoiceListening');
      statusClass = 'text-emerald-700 dark:text-emerald-300';
      dotClass = 'bg-emerald-500 animate-pulse';
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Connection status bar */}
      <div className="shrink-0 px-4 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} aria-hidden />
          <p className={`text-[11px] font-bold uppercase tracking-wide truncate ${statusClass}`}>
            {statusLabel}
          </p>
        </div>
        <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
          {t('liveVoiceTitle')}
        </p>
      </div>

      {/* Speakers + audio activity */}
      <div className="flex-1 flex items-center justify-center gap-8 sm:gap-16 px-4 py-6 min-h-0">
        <div className="flex flex-col items-center gap-2.5">
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-2 transition-all ${
              aiSpeaking
                ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-400 scale-110 shadow-lg shadow-teal-200/50'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
            }`}
          >
            <AiIcon size={36} className={aiSpeaking ? 'text-teal-600 animate-pulse' : 'text-slate-400'} />
          </div>
          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 text-center max-w-[7rem] truncate">
            {aiName}
          </p>
          <div className="flex items-center gap-1.5">
            {aiSpeaking ? (
              <Volume2 size={14} className="text-teal-500 animate-pulse" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            )}
            <p className={`text-[10px] font-bold ${aiSpeaking ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`}>
              {aiIcon === 'patient' ? t('liveVoicePatientSpeaking') : t('liveVoiceExaminerSpeaking')}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-2 transition-all ${
              studentSpeaking
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 scale-110 shadow-lg shadow-emerald-200/50'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Mic size={32} className={studentSpeaking ? 'text-emerald-600 animate-pulse' : 'text-slate-400'} />
          </div>
          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{t('liveVoiceYou')}</p>
          {call.isMuted ? (
            <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
              <MicOff size={12} />
              {t('liveVoiceMuted')}
            </p>
          ) : (
            <MicLevelBars level={call.micLevel} active={studentSpeaking} />
          )}
        </div>
      </div>

      {/* Caption strip (live transcript of what the AI is saying) */}
      <div className="shrink-0 px-4 pb-2">
        {call.aiCaption ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 max-h-24 overflow-y-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">
              {t('liveVoiceCaptionLabel')}
            </p>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200" dir="auto">
              {call.aiCaption}
            </p>
          </div>
        ) : call.isLiveCall ? (
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            {call.isSpeaking ? '' : t('liveVoiceListening')}
          </p>
        ) : null}
      </div>

      {error && (
        <div className="shrink-0 px-4 pb-2">
          <p className="text-[11px] font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2 leading-relaxed">
            {error}
          </p>
        </div>
      )}

      {/* Call controls */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-center gap-3 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={call.toggleMute}
          disabled={connecting}
          title={call.isMuted ? t('liveVoiceUnmute') : t('liveVoiceMute')}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            call.isMuted
              ? 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {call.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {extraActions}

        <button
          type="button"
          onClick={call.stopCall}
          disabled={connecting}
          title={t('endLiveCall')}
          className="h-11 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs inline-flex items-center gap-2 transition-colors disabled:opacity-40"
        >
          {connecting ? <Loader2 size={16} className="animate-spin" /> : <PhoneOff size={16} />}
          {t('endLiveCall')}
        </button>
      </div>
    </div>
  );
}
