import { Mic, MicOff } from 'lucide-react';

interface VoiceMicButtonProps {
  isListening: boolean;
  isSupported: boolean;
  disabled?: boolean;
  onClick: () => void;
  listeningLabel: string;
  notSupportedLabel: string;
}

export function VoiceMicButton({
  isListening,
  isSupported,
  disabled,
  onClick,
  listeningLabel,
  notSupportedLabel,
}: VoiceMicButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !isSupported}
      title={!isSupported ? notSupportedLabel : isListening ? listeningLabel : undefined}
      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
        isListening
          ? 'bg-red-500 text-white animate-pulse ring-2 ring-red-300'
          : isSupported
            ? 'bg-primary text-white hover:bg-primary-dark'
            : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
      }`}
    >
      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  );
}
