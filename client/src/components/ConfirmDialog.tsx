import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirming?: boolean;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirming,
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/60"
        aria-label={cancelLabel}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 mx-auto"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button type="button" onClick={onCancel} disabled={confirming} className="btn-secondary text-sm w-full sm:w-auto">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`text-sm font-semibold px-4 py-2.5 rounded-lg text-white disabled:opacity-60 w-full sm:w-auto ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-primary hover:bg-primary-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
