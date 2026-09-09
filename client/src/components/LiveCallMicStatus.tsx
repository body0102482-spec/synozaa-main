import { Loader2, Mic, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface LiveCallMicStatusProps {
  isLiveCall?: boolean;
  isBusy?: boolean;
  isMicListening?: boolean;
  isSpeaking?: boolean;
  error?: string;
}

export function LiveCallMicStatus({
  isLiveCall,
  isBusy,
  isMicListening,
  isSpeaking,
  error,
}: LiveCallMicStatusProps) {
  const { t } = useTranslation();

  if (!isLiveCall && !error) return null;

  if (error) {
    return (
      <div className="px-3 py-1.5 border-t border-red-100 dark:border-red-900/40 bg-red-50/90 dark:bg-red-950/30">
        <p className="text-[11px] leading-snug font-medium text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  let label = t('liveCallMicReady');
  let dotClass = 'bg-slate-400';
  let barClass = 'border-t border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/30';
  let textClass = 'text-emerald-700 dark:text-emerald-300';
  let trailingIcon: 'mic' | 'volume' | 'spinner' = 'mic';

  if (isBusy) {
    label = t('liveCallMicProcessing');
    dotClass = 'bg-amber-500 animate-pulse';
    barClass = 'border-t border-amber-100 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/30';
    textClass = 'text-amber-800 dark:text-amber-300';
    trailingIcon = 'spinner';
  } else if (isSpeaking) {
    label = t('liveCallMicSpeaking');
    dotClass = 'bg-violet-500 animate-pulse';
    barClass = 'border-t border-violet-100 dark:border-violet-900/40 bg-violet-50/80 dark:bg-violet-950/30';
    textClass = 'text-violet-800 dark:text-violet-300';
    trailingIcon = 'volume';
  } else if (isMicListening) {
    label = t('liveCallMicActive');
    dotClass = 'bg-emerald-500 animate-pulse';
    trailingIcon = 'mic';
  }

  // Keep status above the input bar only — never expand sticky headers over messages.
  return (
    <div className={`px-3 py-1.5 shrink-0 ${barClass}`}>
      <p className={`text-[11px] leading-snug font-medium flex items-center gap-1.5 ${textClass}`}>
        {trailingIcon === 'volume' ? (
          <Volume2 size={12} className="shrink-0" />
        ) : (
          <Mic size={12} className="shrink-0" />
        )}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden />
        <span className="flex-1 truncate">{label}</span>
        {trailingIcon === 'spinner' && (
          <Loader2 size={12} className="shrink-0 animate-spin" aria-hidden />
        )}
      </p>
    </div>
  );
}
