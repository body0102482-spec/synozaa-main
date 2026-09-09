import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../ConfirmDialog';
import { startCaseConfirmMessage, type PendingCaseStart } from '../../lib/startCaseConfirm';

interface EntitlementsLike {
  isFree: boolean;
  freeAttemptsPerCase: number;
  casesRemaining: number;
  attemptsByCase: Record<string, number>;
}

interface StartCaseConfirmDialogProps {
  open: boolean;
  pending: PendingCaseStart | null;
  entitlements: EntitlementsLike | null | undefined;
  confirming?: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StartCaseConfirmDialog({
  open,
  pending,
  entitlements,
  confirming,
  title,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: StartCaseConfirmDialogProps) {
  const { t } = useTranslation();

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
    />
  );
}
