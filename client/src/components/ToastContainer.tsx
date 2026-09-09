import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { subscribeToToasts, dismissToast, type ToastItem } from '../lib/toast';

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 end-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur animate-[toast-in_0.2s_ease-out] ${
            toast.type === 'success'
              ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50/95 dark:bg-red-950/90 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          )}
          <p className="text-sm font-medium flex-1 break-words">{toast.message}</p>
          <button
            type="button"
            className="shrink-0 opacity-60 hover:opacity-100 mt-0.5"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
