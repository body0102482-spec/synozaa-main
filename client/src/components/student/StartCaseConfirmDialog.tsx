import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../ConfirmDialog';
import { startCaseConfirmMessage, type PendingCaseStart } from '../../lib/startCaseConfirm';

export type SessionTypeOption = 'CHAT' | 'LIVE_VOICE';

interface EntitlementsLike {
  isFree: boolean;
  freeAttemptsRemaining: number;
  casesRemaining: number;
  attemptsByCase: Record<string, number>;
}

interface StartCaseConfirmDialogProps {
  open: boolean;
  pending: PendingCaseStart | null;
  entitlements: EntitlementsLike | null | undefined;
  confirming?: boolean;
  selectedSessionType?: SessionTypeOption;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  onSessionTypeChange?: (value: SessionTypeOption) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StartCaseConfirmDialog({
  open,
  pending,
  entitlements,
  confirming,
  selectedSessionType = 'CHAT',
  title,
  confirmLabel,
  cancelLabel,
  onSessionTypeChange,
  onConfirm,
  onCancel,
}: StartCaseConfirmDialogProps) {
  const { t } = useTranslation();

  const sessionOptions: Array<{ value: SessionTypeOption; label: string; detail: string }> = [
    { value: 'CHAT', label: 'Chat Session', detail: '1 credit' },
    { value: 'LIVE_VOICE', label: 'Live Voice Call', detail: '3 credits · 20 minutes' },
  ];

  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={startCaseConfirmMessage(t, entitlements, pending)}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      confirming={confirming}
      variant="default"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="space-y-2">
        {sessionOptions.map((option) => {
          const isActive = selectedSessionType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSessionTypeChange?.(option.value)}
              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                isActive
                  ? 'border-teal-500 bg-teal-50 text-teal-900 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">{option.detail}</span>
              </div>
            </button>
          );
        })}
      </div>
    </ConfirmDialog>
  );
}
